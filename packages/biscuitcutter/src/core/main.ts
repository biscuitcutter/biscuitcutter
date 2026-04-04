/**
 * Main entry point for the `biscuitcutter` command.
 *
 * The code in this module is also a good example of how to use BiscuitCutter
 * as a library rather than a script.
 */

import * as path from 'path';
import * as fs from 'fs';
import { getLogger } from '../utils/log';
import { getUserConfig } from '../config/config';
import { InvalidModeError } from '../utils/exceptions';
import { generateContext, generateFiles } from './generate';
import { runPrePromptHook } from './hooks';
import { chooseNestedTemplate, promptForConfig } from './prompt';
import { dump, load } from './replay';
import { determineRepoDir } from '../repository/repository';
import { rmtree } from '../utils/utils';
import { writeTemplateState, TemplateState } from './tracking';
import { getLatestCommit, isGitRepo } from '../utils/git';

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

  // Run pre_prompt hook
  if (acceptHooks) {
    repoDir = runPrePromptHook(baseRepoDir);
  }
  cleanup = repoDir !== baseRepoDir;

  const templateName = path.basename(path.resolve(repoDir));

  let contextFromReplayFile: Record<string, any> | undefined;
  if (replay) {
    if (typeof replay === 'boolean') {
      contextFromReplayFile = load(configDict.replay_dir, templateName);
    } else {
      const parsed = path.parse(replay);
      contextFromReplayFile = load(parsed.dir, parsed.name);
    }
  }

  let contextFile = path.join(repoDir, 'biscuitcutter.json');
  if (!fs.existsSync(contextFile)) {
    contextFile = path.join(repoDir, 'cookiecutter.json');
  }
  logger.debug('context_file is %s', contextFile);

  let context: Record<string, any>;
  let contextForPrompting: Record<string, any>;

  if (replay && contextFromReplayFile) {
    context = generateContext(
      contextFile,
      configDict.default_context,
      null,
    );
    logger.debug('replayfile context: %s', JSON.stringify(contextFromReplayFile));
    const itemsForPrompting: Record<string, any> = {};
    for (const [k, v] of Object.entries(context.biscuitcutter)) {
      if (!(k in contextFromReplayFile.biscuitcutter)) {
        itemsForPrompting[k] = v;
      }
    }
    contextForPrompting = { biscuitcutter: itemsForPrompting };
    context = contextFromReplayFile;
    logger.debug('prompting context: %s', JSON.stringify(contextForPrompting));
  } else {
    context = generateContext(
      contextFile,
      configDict.default_context,
      extraContext,
    );
    contextForPrompting = context;
  }

  // Preserve the original cookiecutter options
  context._cookiecutter = Object.fromEntries(
    Object.entries(context.biscuitcutter).filter(([k]) => !k.startsWith('_')),
  );

  // Check for nested templates
  const contextKeys = new Set(Object.keys(context.biscuitcutter));
  if (contextKeys.has('template') || contextKeys.has('templates')) {
    const nestedTemplate = await chooseNestedTemplate(
      context,
      repoDir,
      noInput,
    );
    return biscuitcutter({
      ...options,
      template: nestedTemplate,
    });
  }

  // Prompt user for config
  if (contextForPrompting.biscuitcutter && Object.keys(contextForPrompting.biscuitcutter).length > 0) {
    const promptedConfig = await promptForConfig(contextForPrompting, noInput);
    Object.assign(context.biscuitcutter, promptedConfig);
  }

  logger.debug('context is %s', JSON.stringify(context));

  // Include template dir or url in the context dict
  context.biscuitcutter._template = template;
  context.biscuitcutter._output_dir = path.resolve(outputDir);
  context.biscuitcutter._repo_dir = repoDir;
  context.biscuitcutter._checkout = checkout;

  dump(configDict.replay_dir, templateName, context);

  // Create project from local context and project template
  const result = generateFiles(
    repoDir,
    context,
    outputDir,
    overwriteIfExists,
    skipIfFileExists,
    acceptHooks,
    keepProjectOnFailure,
  );

  // Write template state file for update tracking
  try {
    const commit = isGitRepo(baseRepoDir) ? getLatestCommit(baseRepoDir) : null;
    // Filter out private variables (they're machine-specific and not useful for tracking)
    const filteredContext: Record<string, any> = {};
    for (const [key, value] of Object.entries(context.biscuitcutter)) {
      if (!key.startsWith('_')) {
        filteredContext[key] = value;
      }
    }
    const templateState: TemplateState = {
      template,
      commit: commit || 'unknown',
      checkout: checkout || null,
      context: filteredContext,
      directory: directory || null,
    };
    writeTemplateState(result, templateState);
    logger.debug('Wrote template state to %s/.biscuitcutter.json', result);
  } catch (e) {
    logger.debug('Could not write template state file: %s', e);
  }

  // Cleanup (if required)
  if (cleanup) {
    rmtree(repoDir);
  }
  if (cleanupBaseRepoDir) {
    rmtree(baseRepoDir);
  }

  return result;
}
