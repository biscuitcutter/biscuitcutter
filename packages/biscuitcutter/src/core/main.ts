/**
 * Main entry point for the `biscuitcutter` command.
 *
 * The code in this module is also a good example of how to use BiscuitCutter
 * as a library rather than a script.
 */

import * as path from 'path';
import { getLogger } from '../utils/log';
import { getUserConfig } from '../config/config';
import { InvalidModeError } from '../utils/exceptions';
import { generateFilesWithAdapter } from './generate';
import { runPrePromptHook, runCopierTasks } from './hooks';
import { chooseNestedTemplate, promptForConfigWithAdapter } from './prompt';
import { dump, load } from './replay';
import { determineRepoDir } from '../repository/repository';
import { rmtree } from '../utils/utils';
import { getLatestCommit, isGitRepo } from '../utils/git';
import { detectTemplateType, createAdapter } from './adapters/detect';

const logger = getLogger('biscuitcutter.main');

export interface BiscuitCutterOptions {
  /** A directory containing a project template directory, or a URL to a git repository. */
  template: string;
  /** The branch, tag or commit ID to checkout after clone. */
  checkout?: string | null;
  /** Do not prompt for user input. */
  noInput?: boolean;
  /** A dictionary of context that overrides default and user configuration. */
  extraContext?: Record<string, any> | null;
  /** Do not prompt for input, instead read from saved json. */
  replay?: boolean | string | null;
  /** Overwrite the contents of the output directory if it exists. */
  overwriteIfExists?: boolean;
  /** Where to output the generated project dir into. */
  outputDir?: string;
  /** User configuration file path. */
  configFile?: string | null;
  /** Use default values rather than a config file. */
  defaultConfig?: boolean;
  /** The password to use when extracting the repository. */
  password?: string | null;
  /** Relative path to a cookiecutter template in a repository. */
  directory?: string | null;
  /** Skip the files in the corresponding directories if they already exist. */
  skipIfFileExists?: boolean;
  /** Accept pre and post hooks if set to true. */
  acceptHooks?: boolean;
  /** If true keep generated project directory even when generation fails. */
  keepProjectOnFailure?: boolean;
}

/**
 * Run BiscuitCutter just as if using it from the command line.
 */
export async function biscuitcutter(options: BiscuitCutterOptions): Promise<string> {
  const {
    template,
    checkout = null,
    noInput = false,
    extraContext = null,
    replay = null,
    overwriteIfExists = false,
    outputDir = '.',
    configFile = null,
    defaultConfig = false,
    password = null,
    directory = null,
    skipIfFileExists = false,
    acceptHooks = true,
    keepProjectOnFailure = false,
  } = options;

  if (replay && (noInput !== false || extraContext !== null)) {
    throw new InvalidModeError(
      'You can not use both replay and no_input or extra_context at the same time.',
    );
  }

  const configDict = getUserConfig(configFile, defaultConfig);

  const [baseRepoDir, cleanupBaseRepoDir] = await determineRepoDir(
    template,
    configDict.abbreviations,
    configDict.biscuitcutters_dir,
    checkout,
    noInput,
    password,
    directory,
  );

  let repoDir: string = baseRepoDir;
  let cleanup = cleanupBaseRepoDir;

  if (acceptHooks) {
    repoDir = runPrePromptHook(baseRepoDir);
  }
  cleanup = repoDir !== baseRepoDir;

  const templateName = path.basename(path.resolve(repoDir));

  const templateType = detectTemplateType(repoDir);
  logger.debug('Detected template type: %s', templateType);

  const adapter = createAdapter(templateType);
  const config = adapter.loadConfig(repoDir);

  logger.debug(
    'Config loaded: %d variables, suffix=%s',
    config.variables.length,
    config.templatesSuffix,
  );

  // Apply user default_context to variable defaults (cookiecutter/biscuitcutter only)
  if (templateType !== 'copier' && configDict.default_context) {
    for (const variable of config.variables) {
      if (variable.name in configDict.default_context) {
        variable.default = configDict.default_context[variable.name];
      }
    }
  }

  // Handle nested templates (cookiecutter/biscuitcutter only)
  if (templateType !== 'copier') {
    const rawCtx = config.rawContext;
    if ('template' in rawCtx || 'templates' in rawCtx) {
      const legacyCtx = { biscuitcutter: { ...rawCtx } };
      const nestedTemplate = await chooseNestedTemplate(legacyCtx, repoDir, noInput);
      return biscuitcutter({ ...options, template: nestedTemplate });
    }
  }

  // Load replay file and determine which variables still need prompting
  let savedVariables: Record<string, any> = {};
  let variablesToPrompt = config.variables;
  if (replay && templateType !== 'copier') {
    let replayData: Record<string, any> | undefined;
    if (typeof replay === 'boolean') {
      replayData = load(configDict.replay_dir, templateName);
    } else {
      const parsed = path.parse(replay as string);
      replayData = load(parsed.dir, parsed.name);
    }
    if (replayData) {
      savedVariables = replayData.biscuitcutter || {};
      variablesToPrompt = config.variables.filter((v) => !(v.name in savedVariables));
    }
  }

  // Prompt for variables
  const env = adapter.createEnvironment(config, {}, [repoDir]);
  const promptedVariables = await promptForConfigWithAdapter(
    variablesToPrompt,
    {},
    env,
    noInput,
  );

  const userVariables = { ...savedVariables, ...promptedVariables };

  if (extraContext) {
    Object.assign(userVariables, extraContext);
  }

  // Build the template context with format-specific metadata
  const metadata: Record<string, any> = templateType === 'copier'
    ? { src_path: template, dst_path: path.resolve(outputDir) }
    : {
      _template: template,
      _output_dir: path.resolve(outputDir),
      _repo_dir: repoDir,
      _checkout: checkout,
    };

  const context = adapter.buildContext(userVariables, metadata);
  logger.debug('context is %s', JSON.stringify(context));

  // Save replay file (cookiecutter/biscuitcutter only)
  if (templateType !== 'copier') {
    dump(configDict.replay_dir, templateName, context);
  }

  // For Copier, derive output dir name from user variables; for others let
  // generateFilesWithAdapter fall back to the template directory name.
  const outputDirName = templateType === 'copier'
    ? (userVariables.project_slug || userVariables.project_name || templateName)
    : undefined;

  const result = generateFilesWithAdapter(
    repoDir,
    adapter,
    config,
    context,
    outputDir,
    overwriteIfExists,
    skipIfFileExists,
    acceptHooks,
    keepProjectOnFailure,
    outputDirName,
  );

  // Run post-generation tasks (Copier only)
  if (templateType === 'copier' && acceptHooks && config.tasks.length > 0) {
    runCopierTasks(config.tasks, result, context);
  }

  // Write state/answers file
  try {
    const commit = isGitRepo(baseRepoDir) ? getLatestCommit(baseRepoDir) : null;
    adapter.writeStateFile(
      result,
      template,
      commit || 'unknown',
      checkout,
      context,
      directory,
    );
    logger.debug('Wrote state files to %s', result);
  } catch (e) {
    logger.debug('Could not write template state files: %s', e);
  }

  if (cleanup) {
    rmtree(repoDir);
  }
  if (cleanupBaseRepoDir) {
    rmtree(baseRepoDir);
  }

  return result;
}
