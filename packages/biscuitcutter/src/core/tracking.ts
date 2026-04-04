/**
 * Template tracking for BiscuitCutter.
 *
 * Tracks the template version used to generate a project and enables updates
 * when the upstream template changes.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import { spawnSync } from 'child_process';
import { getLogger } from '../utils/log';
import { getUserConfig } from '../config/config';
import {
  TemplateStateNotFoundError,
  TemplateStateExistsError,
  DirtyGitRepositoryError,
  UnableToFindCookiecutterTemplateError,
} from '../utils/exceptions';
import {
  isRepoClean,
  cloneRepo,
  getLatestCommit,
  resetToCommit,
  isProjectUpdated,
  getDiff,
  displayDiff,
  applyPatch,
  createTempDir,
} from '../utils/git';
import { generateContext, generateFiles } from './generate';
import { promptForConfig } from './prompt';
import { expandAbbreviations } from '../repository/repository';

const logger = getLogger('biscuitcutter.tracking');

/** The state file name for template tracking. */
export const STATE_FILE = '.biscuitcutter.json';

// ==========================================
// Types
// ==========================================

/**
 * The structure of the .biscuitcutter.json state file.
 */
export interface TemplateState {
  /** URL of the template repository. */
  template: string;
  /** Git commit hash the project was generated from or last updated to. */
  commit: string;
  /** The branch, tag, or reference used during checkout. */
  checkout: string | null;
  /** The context variables used to generate the project. */
  context: Record<string, any>;
  /** Subdirectory within the repo containing the template. */
  directory: string | null;
  /** Paths to skip during updates (glob patterns or relative paths). */
  skip?: string[];
}

export interface CreateOptions {
  templateGitUrl: string;
  outputDir?: string;
  configFile?: string | null;
  defaultConfig?: boolean;
  extraContext?: Record<string, any> | null;
  extraContextFile?: string | null;
  noInput?: boolean;
  directory?: string | null;
  checkout?: string | null;
  overwriteIfExists?: boolean;
  skip?: string[];
}

export interface CheckOptions {
  projectDir?: string;
  checkout?: string | null;
  strict?: boolean;
}

export interface CheckResult {
  upToDate: boolean;
  currentCommit: string;
  latestCommit: string;
  message: string;
}

export interface UpdateOptions {
  projectDir?: string;
  templatePath?: string | null;
  biscuitcutterInput?: boolean;
  refreshPrivateVariables?: boolean;
  skipApplyAsk?: boolean;
  skipUpdate?: boolean;
  checkout?: string | null;
  strict?: boolean;
  allowUntrackedFiles?: boolean;
  extraContext?: Record<string, any> | null;
  extraContextFile?: string | null;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  diff?: string;
  alreadyUpToDate?: boolean;
}

export interface DiffOptions {
  projectDir?: string;
  exitCode?: boolean;
  checkout?: string | null;
}

export interface DiffResult {
  hasDiff: boolean;
  diff: string;
  exitCode: number;
}

export interface LinkOptions {
  templateGitUrl: string;
  projectDir?: string;
  checkout?: string | null;
  noInput?: boolean;
  configFile?: string | null;
  defaultConfig?: boolean;
  extraContext?: Record<string, any> | null;
  directory?: string | null;
}

// ==========================================
// State Management
// ==========================================

/**
 * Get the path to the .biscuitcutter.json file in a project directory.
 */
export function getStateFile(projectDir: string, mustExist: boolean = true): string {
  const stateFile = path.join(projectDir, STATE_FILE);

  if (!mustExist && fs.existsSync(stateFile)) {
    throw new TemplateStateExistsError(stateFile);
  }

  if (mustExist && !fs.existsSync(stateFile)) {
    throw new TemplateStateNotFoundError(path.resolve(projectDir));
  }

  return stateFile;
}

/**
 * Read and parse the template state from a project directory.
 */
export function readTemplateState(projectDir: string): TemplateState {
  const stateFile = getStateFile(projectDir);
  const content = fs.readFileSync(stateFile, 'utf-8');
  return JSON.parse(content) as TemplateState;
}

/**
 * Write template state to a .biscuitcutter.json file.
 */
export function writeTemplateState(projectDir: string, state: TemplateState): void {
  const stateFile = path.join(projectDir, STATE_FILE);
  const content = `${JSON.stringify(state, null, 2)}\n`;
  fs.writeFileSync(stateFile, content, 'utf-8');
}

/**
 * Remove private variables (starting with _) from context, preserving _commit and _template.
 */
export function cleanPrivateVariables(state: TemplateState): void {
  for (const key of Object.keys(state.context)) {
    if (key !== '_commit' && key !== '_template' && key.startsWith('_')) {
      delete state.context[key];
    }
  }
}

/**
 * Get the list of paths to skip during updates.
 */
export function getSkipPaths(state: TemplateState, projectDir: string): Set<string> {
  const skipPaths = new Set<string>(state.skip || []);

  // Check for pyproject.toml configuration
  const pyprojectPath = path.join(projectDir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const tomlContent = fs.readFileSync(pyprojectPath, 'utf-8');
      // Support both [tool.biscuitcutter] and legacy [tool.cruft]
      const biscuitMatch = tomlContent.match(/\[tool\.biscuitcutter\][\s\S]*?skip\s*=\s*\[([\s\S]*?)\]/);
      const cruftMatch = tomlContent.match(/\[tool\.cruft\][\s\S]*?skip\s*=\s*\[([\s\S]*?)\]/);
      const match = biscuitMatch || cruftMatch;
      if (match) {
        const items = match[1].match(/"([^"]+)"|'([^']+)'/g);
        if (items) {
          for (const item of items) {
            skipPaths.add(item.replace(/["']/g, ''));
          }
        }
      }
    } catch {
      // Ignore TOML parsing errors
    }
  }

  // Check for package.json configuration
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const config = packageJson.biscuitcutter || packageJson.cruft;
      if (config?.skip && Array.isArray(config.skip)) {
        for (const item of config.skip) {
          skipPaths.add(item);
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }

  return skipPaths;
}

// ==========================================
// Internal Helpers
// ==========================================

function resolveTemplateUrl(templateUrl: string): string {
  const config = getUserConfig();
  const expanded = expandAbbreviations(templateUrl, config.abbreviations);

  if (!expanded.match(/^[a-z]+:\/\//i) && !expanded.startsWith('git@')) {
    const absolutePath = path.resolve(expanded);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }
  return expanded;
}

function validateCookiecutterTemplate(templateDir: string): void {
  const entries = fs.readdirSync(templateDir);
  const hasTemplate = entries.some((entry) => {
    const fullPath = path.join(templateDir, entry);
    return (
      fs.statSync(fullPath).isDirectory()
      && entry.includes('cookiecutter')
      && entry.includes('{{')
      && entry.includes('}}')
    );
  });

  if (!hasTemplate && !fs.existsSync(path.join(templateDir, 'biscuitcutter.json')) && !fs.existsSync(path.join(templateDir, 'cookiecutter.json'))) {
    throw new UnableToFindCookiecutterTemplateError(templateDir);
  }
}

function getDeletedFiles(templateDir: string, projectDir: string): Set<string> {
  const deletedPaths = new Set<string>();

  function walkDir(dir: string, relativePath: string = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      const templatePath = path.join(dir, entry.name);
      const projectPath = path.join(projectDir, entryRelativePath);

      if (entry.isDirectory()) {
        if (!fs.existsSync(projectPath)) {
          deletedPaths.add(entryRelativePath);
        } else {
          walkDir(templatePath, entryRelativePath);
        }
      } else if (!fs.existsSync(projectPath)) {
        deletedPaths.add(entryRelativePath);
      }
    }
  }

  walkDir(templateDir);
  return deletedPaths;
}

function removeMatchingPaths(
  dir: string,
  pattern: RegExp,
  relativePath: string = '',
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (pattern.test(entryRelative)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      removeMatchingPaths(fullPath, pattern, entryRelative);
    }
  }
}

function removePaths(rootDir: string, pathsToRemove: Set<string>): void {
  for (const pathToRemove of pathsToRemove) {
    if (pathToRemove.includes('*')) {
      const pattern = new RegExp(
        `^${pathToRemove.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
      );
      removeMatchingPaths(rootDir, pattern);
    } else {
      const fullPath = path.join(rootDir, pathToRemove);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }
  }
}

interface GenerateTemplateOptions {
  outputDir: string;
  repoDir: string;
  templateState: TemplateState;
  projectDir: string;
  checkout?: string | null;
  deletedPaths?: Set<string>;
  updateDeletedPaths?: boolean;
}

async function generateTemplateForDiff(options: GenerateTemplateOptions): Promise<Record<string, any>> {
  const {
    outputDir,
    repoDir,
    templateState,
    projectDir,
    checkout,
    deletedPaths = new Set<string>(),
    updateDeletedPaths = false,
  } = options;

  if (checkout) {
    resetToCommit(repoDir, checkout);
  }

  const innerDir = templateState.directory ? path.join(repoDir, templateState.directory) : repoDir;

  const extraContext: Record<string, any> = {};
  for (const [key, value] of Object.entries(templateState.context)) {
    if (!key.startsWith('_')) {
      extraContext[key] = value;
    }
  }

  const targetCommit = checkout || getLatestCommit(repoDir);
  validateCookiecutterTemplate(innerDir);

  let contextFile = path.join(innerDir, 'biscuitcutter.json');
  if (!fs.existsSync(contextFile)) {
    contextFile = path.join(innerDir, 'cookiecutter.json');
  }
  const newContext = generateContext(contextFile, null, extraContext);
  newContext.biscuitcutter._template = templateState.template;
  newContext.biscuitcutter._commit = targetCommit;

  // Flatten choice arrays to selected values (matching Python cruft behavior)
  const flatContext = await promptForConfig(newContext, true);
  newContext.biscuitcutter = flatContext;

  fs.mkdirSync(outputDir, { recursive: true });

  const tempDir = createTempDir('biscuitcutter-gen-');

  try {
    const generatedDir = generateFiles(innerDir, newContext, tempDir, true, false, false, false);

    const entries = fs.readdirSync(generatedDir);
    for (const entry of entries) {
      const src = path.join(generatedDir, entry);
      const dest = path.join(outputDir, entry);
      fsExtra.moveSync(src, dest, { overwrite: true });
    }

    const skipPaths = getSkipPaths(templateState, projectDir);

    if (updateDeletedPaths) {
      const deleted = getDeletedFiles(outputDir, projectDir);
      for (const p of deleted) {
        deletedPaths.add(p);
      }
    }

    const pathsToRemove = new Set([...skipPaths, ...deletedPaths]);
    removePaths(outputDir, pathsToRemove);

    return newContext;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function copyMatchingFiles(templateDir: string, projectDir: string, destDir: string): void {
  function walkAndCopy(currentTemplateDir: string, currentProjectDir: string, currentDestDir: string): void {
    const entries = fs.readdirSync(currentTemplateDir, { withFileTypes: true });
    for (const entry of entries) {
      const templatePath = path.join(currentTemplateDir, entry.name);
      const projectPath = path.join(currentProjectDir, entry.name);
      const destPath = path.join(currentDestDir, entry.name);

      if (entry.isDirectory()) {
        if (fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          try {
            fs.chmodSync(destPath, fs.statSync(projectPath).mode);
          } catch {
            // Ignore permission errors
          }
          walkAndCopy(templatePath, projectPath, destPath);
        }
      } else if (fs.existsSync(projectPath)) {
        fsExtra.copySync(projectPath, destPath, { dereference: false });
      }
    }
  }
  walkAndCopy(templateDir, projectDir, destDir);
}

async function promptForApply(
  patchDiff: string,
  oldDir: string,
  newDir: string,
): Promise<'y' | 'n' | 's'> {
  const inquirer = await import('inquirer');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { action } = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Apply diff and update?',
        choices: [
          { name: 'Yes - apply the changes', value: 'y' },
          { name: 'No - cancel the update', value: 'n' },
          { name: 'Skip - mark as updated without applying', value: 's' },
          { name: 'View - show the diff', value: 'v' },
        ],
        default: 'y',
      },
    ]);

    if (action === 'v') {
      if (patchDiff.trim()) {
        displayDiff(oldDir, newDir);
      } else {
        console.log('There are no changes.');
      }
      continue;
    }

    return action;
  }
}

// ==========================================
// Commands
// ==========================================

/**
 * Create a new project from a cookiecutter template with update tracking.
 */
export async function create(options: CreateOptions): Promise<string> {
  const {
    templateGitUrl: rawTemplateUrl,
    outputDir = '.',
    configFile = null,
    defaultConfig = false,
    extraContext: providedExtraContext = null,
    extraContextFile = null,
    noInput = false,
    directory = null,
    checkout = null,
    overwriteIfExists = false,
    skip,
  } = options;

  const templateGitUrl = resolveTemplateUrl(rawTemplateUrl);
  const tempDir = createTempDir('biscuitcutter-create-');

  try {
    logger.debug('Cloning template from %s', templateGitUrl);
    const repoDir = cloneRepo(templateGitUrl, path.join(tempDir, 'repo'), checkout);
    const lastCommit = getLatestCommit(repoDir);

    let cookiecutterTemplateDir = repoDir;
    if (directory) {
      cookiecutterTemplateDir = path.join(repoDir, directory);
    }

    validateCookiecutterTemplate(cookiecutterTemplateDir);

    let extraContext = providedExtraContext || {};
    if (extraContextFile) {
      const extraContextContent = fs.readFileSync(extraContextFile, 'utf-8');
      const fileContext = JSON.parse(extraContextContent);
      extraContext = { ...extraContext, ...fileContext };
    }

    const configDict = getUserConfig(configFile, defaultConfig);
    let contextFile = path.join(cookiecutterTemplateDir, 'biscuitcutter.json');
    if (!fs.existsSync(contextFile)) {
      contextFile = path.join(cookiecutterTemplateDir, 'cookiecutter.json');
    }
    const context = generateContext(contextFile, configDict.default_context, extraContext);

    if (!noInput) {
      const promptedConfig = await promptForConfig(context, false);
      Object.assign(context.biscuitcutter, promptedConfig);
    }

    context.biscuitcutter._template = templateGitUrl;
    context.biscuitcutter._commit = lastCommit;

    const projectDir = generateFiles(
      cookiecutterTemplateDir,
      context,
      outputDir,
      overwriteIfExists,
      false,
      false,
      false,
    );

    // Filter out private variables (they're machine-specific)
    const filteredContext: Record<string, any> = {};
    for (const [key, value] of Object.entries(context.biscuitcutter)) {
      if (!key.startsWith('_')) {
        filteredContext[key] = value;
      }
    }

    const templateState: TemplateState = {
      template: templateGitUrl,
      commit: lastCommit,
      checkout,
      context: filteredContext,
      directory,
    };

    if (skip && skip.length > 0) {
      templateState.skip = skip;
    }

    writeTemplateState(projectDir, templateState);

    logger.info('Project created successfully at %s', projectDir);
    return projectDir;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Check if the project is up to date with its cookiecutter template.
 */
export async function check(options: CheckOptions = {}): Promise<CheckResult> {
  const { projectDir = '.', checkout = null, strict = true } = options;

  const templateState = readTemplateState(projectDir);
  const tempDir = createTempDir('biscuitcutter-check-');

  try {
    const resolvedUrl = resolveTemplateUrl(templateState.template);
    const cloneDir = path.join(tempDir, 'repo');

    logger.debug('Checking template at %s', resolvedUrl);
    cloneRepo(resolvedUrl, cloneDir, checkout || templateState.checkout, true);

    if (!checkout && !templateState.checkout) {
      spawnSync('git', ['checkout'], {
        cwd: cloneDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    const latestCommit = getLatestCommit(cloneDir);
    const currentCommit = templateState.commit;

    const upToDate = isProjectUpdated(cloneDir, currentCommit, latestCommit, strict);

    if (upToDate) {
      return {
        upToDate: true,
        currentCommit,
        latestCommit,
        message: 'Project is up to date with its template.',
      };
    }

    return {
      upToDate: false,
      currentCommit,
      latestCommit,
      message: 'Project is out of date. Run `biscuitcutter update` to update from the template.',
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Update the project to match a newer version of its template.
 */
export async function update(options: UpdateOptions = {}): Promise<UpdateResult> {
  const {
    projectDir = '.',
    templatePath = null,
    biscuitcutterInput = false,
    refreshPrivateVariables = false,
    skipApplyAsk = true,
    skipUpdate = false,
    checkout = null,
    strict = true,
    allowUntrackedFiles = false,
    extraContext: providedExtraContext = null,
    extraContextFile = null,
  } = options;

  const stateFile = path.join(projectDir, STATE_FILE);
  const templateState = readTemplateState(projectDir);

  let extraContext = providedExtraContext || {};
  if (extraContextFile) {
    if (path.resolve(extraContextFile) === path.resolve(stateFile)) {
      return {
        success: false,
        message:
          "The file path given to --extra-context-file cannot be the same as the project's state file.",
      };
    }

    const extraContextContent = fs.readFileSync(extraContextFile, 'utf-8');
    const fileContext = JSON.parse(extraContextContent);
    const parsedContext = fileContext.context || fileContext;
    extraContext = { ...extraContext, ...parsedContext };
  }

  if (!isRepoClean(projectDir, allowUntrackedFiles)) {
    throw new DirtyGitRepositoryError(
      'Cannot apply updates on an unclean git project. Please make sure your git working tree is clean.',
    );
  }

  const tempDir = createTempDir('biscuitcutter-update-');

  try {
    const repoDir = path.join(tempDir, 'repo');
    const currentTemplateDir = path.join(tempDir, 'current_template');
    const newTemplateDir = path.join(tempDir, 'new_template');
    const deletedPaths = new Set<string>();

    const templateGitUrl = templatePath ? resolveTemplateUrl(templatePath) : resolveTemplateUrl(templateState.template);

    logger.debug('Cloning template from %s', templateGitUrl);
    cloneRepo(templateGitUrl, repoDir, checkout || templateState.checkout);

    const latestCommit = getLatestCommit(repoDir);

    if (
      (!extraContext || Object.keys(extraContext).length === 0)
      && !biscuitcutterInput
      && !refreshPrivateVariables
    ) {
      if (isProjectUpdated(repoDir, templateState.commit, latestCommit, strict)) {
        return {
          success: true,
          message: 'Nothing to do, project is already up to date!',
          alreadyUpToDate: true,
        };
      }
    }

    const workingState: TemplateState = JSON.parse(JSON.stringify(templateState));

    fs.mkdirSync(currentTemplateDir, { recursive: true });
    await generateTemplateForDiff({
      outputDir: currentTemplateDir,
      repoDir,
      templateState: workingState,
      projectDir,
      checkout: workingState.commit,
      deletedPaths,
      updateDeletedPaths: true,
    });

    if (refreshPrivateVariables) {
      cleanPrivateVariables(workingState);
    }

    if (extraContext && Object.keys(extraContext).length > 0) {
      Object.assign(workingState.context, extraContext);
    }

    fs.mkdirSync(newTemplateDir, { recursive: true });
    const newContext = await generateTemplateForDiff({
      outputDir: newTemplateDir,
      repoDir,
      templateState: workingState,
      projectDir,
      checkout: latestCommit,
      deletedPaths,
      updateDeletedPaths: false,
    });

    const patchDiff = getDiff(currentTemplateDir, newTemplateDir);

    let shouldApply = !skipUpdate;

    if (!skipApplyAsk && !skipUpdate) {
      const response = await promptForApply(patchDiff, currentTemplateDir, newTemplateDir);

      if (response === 'n') {
        return { success: false, message: 'User cancelled template update.', diff: patchDiff };
      }
      if (response === 's') {
        shouldApply = false;
      }
    }

    if (shouldApply && patchDiff.trim()) {
      const applyResult = applyPatch(patchDiff, projectDir, allowUntrackedFiles);
      if (applyResult.message) {
        console.warn(applyResult.message);
      }
    }

    workingState.commit = latestCommit;
    workingState.checkout = checkout;
    // Use flattened context from new template (choice arrays resolved to selected values)
    const filteredContext: Record<string, any> = {};
    for (const [key, value] of Object.entries(newContext.biscuitcutter)) {
      if (!key.startsWith('_')) {
        filteredContext[key] = value;
      }
    }
    workingState.context = filteredContext;
    if (templatePath) {
      workingState.template = templateGitUrl;
    }

    writeTemplateState(projectDir, workingState);

    return {
      success: true,
      message: 'Project has been updated from the template!',
      diff: patchDiff,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Show the diff between the project and its linked cookiecutter template.
 */
export async function diff(options: DiffOptions = {}): Promise<DiffResult> {
  const { projectDir = '.', exitCode = false, checkout = null } = options;

  const templateState = readTemplateState(projectDir);
  const effectiveCheckout = checkout || templateState.commit;

  const tempDir = createTempDir('biscuitcutter-diff-');

  try {
    const repoDir = path.join(tempDir, 'repo');
    const remoteTemplateDir = path.join(tempDir, 'remote');
    const localTemplateDir = path.join(tempDir, 'local');

    fs.mkdirSync(remoteTemplateDir, { recursive: true });
    fs.mkdirSync(localTemplateDir, { recursive: true });

    const resolvedUrl = resolveTemplateUrl(templateState.template);

    logger.debug('Cloning template from %s', resolvedUrl);
    cloneRepo(resolvedUrl, repoDir, effectiveCheckout);

    await generateTemplateForDiff({
      outputDir: remoteTemplateDir,
      repoDir,
      templateState,
      projectDir,
      checkout: effectiveCheckout,
      updateDeletedPaths: true,
    });

    copyMatchingFiles(remoteTemplateDir, projectDir, localTemplateDir);

    const diffOutput = getDiff(localTemplateDir, remoteTemplateDir);
    const hasDiff = diffOutput.trim().length > 0;

    if (hasDiff) {
      if (exitCode || !process.stdout.isTTY) {
        console.log(diffOutput);
      } else {
        displayDiff(localTemplateDir, remoteTemplateDir);
      }
    }

    return {
      hasDiff,
      diff: diffOutput,
      exitCode: hasDiff && exitCode ? 1 : 0,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Link an existing project to a cookiecutter template.
 */
export async function link(options: LinkOptions): Promise<boolean> {
  const {
    templateGitUrl: rawTemplateUrl,
    projectDir = '.',
    checkout = null,
    noInput = false,
    configFile = null,
    defaultConfig = false,
    extraContext = null,
    directory = null,
  } = options;

  getStateFile(projectDir, false);

  const templateGitUrl = resolveTemplateUrl(rawTemplateUrl);
  const tempDir = createTempDir('biscuitcutter-link-');

  try {
    logger.debug('Cloning template from %s', templateGitUrl);
    const repoDir = cloneRepo(templateGitUrl, path.join(tempDir, 'repo'), checkout);
    const lastCommit = getLatestCommit(repoDir);

    let cookiecutterTemplateDir = repoDir;
    if (directory) {
      cookiecutterTemplateDir = path.join(repoDir, directory);
    }

    validateCookiecutterTemplate(cookiecutterTemplateDir);

    const configDict = getUserConfig(configFile, defaultConfig);
    let contextFile = path.join(cookiecutterTemplateDir, 'biscuitcutter.json');
    if (!fs.existsSync(contextFile)) {
      contextFile = path.join(cookiecutterTemplateDir, 'cookiecutter.json');
    }
    const context = generateContext(contextFile, configDict.default_context, extraContext);

    if (!noInput) {
      const promptedConfig = await promptForConfig(context, false);
      Object.assign(context.biscuitcutter, promptedConfig);
    }

    context.biscuitcutter._template = templateGitUrl;
    context.biscuitcutter._commit = lastCommit;

    let useCommit = lastCommit;

    if (!noInput) {
      const inquirer = await import('inquirer');

      console.log(`Linking against the commit: ${lastCommit}`);
      if (checkout) {
        console.log(`which corresponds with the git reference: ${checkout}`);
      }

      const { commitChoice } = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'commitChoice',
          message: 'Press enter to link against this commit or provide an alternative commit:',
          default: lastCommit,
        },
      ]);

      useCommit = commitChoice || lastCommit;
    }

    // Filter out private variables (they're machine-specific)
    const filteredContext: Record<string, any> = {};
    for (const [key, value] of Object.entries(context.biscuitcutter)) {
      if (!key.startsWith('_')) {
        filteredContext[key] = value;
      }
    }

    const templateState: TemplateState = {
      template: templateGitUrl,
      commit: useCommit,
      checkout,
      context: filteredContext,
      directory,
    };

    writeTemplateState(projectDir, templateState);

    logger.info('Project linked successfully to %s at commit %s', templateGitUrl, useCommit);
    return true;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
