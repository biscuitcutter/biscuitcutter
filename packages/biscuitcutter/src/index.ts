/**
 * BiscuitCutter - A TypeScript port of Cookiecutter.
 *
 * A command-line utility that creates projects from project templates.
 */

// Core business logic
export { biscuitcutter, BiscuitCutterOptions } from './core/main';
export { generateContext, generateFiles, generateFile } from './core/generate';
export { promptForConfig, chooseNestedTemplate, renderVariable } from './core/prompt';
export { dump as replayDump, load as replayLoad } from './core/replay';
export { findTemplate } from './core/find';

// Repository handling
export {
  determineRepoDir, isRepoUrl, isZipFile, expandAbbreviations,
} from './repository/repository';
export { clone, identifyRepo, isVcsInstalled } from './repository/vcs';
export { unzip } from './repository/zipfile';

// Configuration
export {
  getUserConfig, getConfig, mergeConfigs, BiscuitCutterConfig,
} from './config/config';

// Template engine
export { createStrictEnvironment } from './templating';

// Utilities
export { configureLogger, getLogger } from './utils/log';
export {
  rmtree,
  makeSurePathExists,
  workIn,
  makeExecutable,
  createTmpRepoDir,
  createEnvWithContext,
} from './utils/utils';
export {
  BiscuitCutterError,
  NonTemplatedInputDirError,
  ConfigDoesNotExistError,
  InvalidConfigurationError,
  UnknownRepoTypeError,
  VCSNotInstalledError,
  ContextDecodingError,
  OutputDirExistsError,
  EmptyDirNameError,
  InvalidModeError,
  FailedHookError,
  UndefinedVariableInTemplateError,
  UnknownExtensionError,
  RepositoryNotFoundError,
  RepositoryCloneFailedError,
  InvalidZipRepositoryError,
  PathTraversalError,
  // Template tracking exceptions
  TemplateStateNotFoundError,
  TemplateStateExistsError,
  InvalidCookiecutterRepositoryError,
  UnableToFindCookiecutterTemplateError,
  ChangesetUnicodeError,
  DirtyGitRepositoryError,
} from './utils/exceptions';

// Template tracking - update projects from their templates
export {
  // Commands
  create,
  check,
  update,
  diff,
  link,
  // Types
  CreateOptions,
  CheckOptions,
  CheckResult,
  UpdateOptions,
  UpdateResult,
  DiffOptions,
  DiffResult,
  LinkOptions,
  // State management
  TemplateState,
  STATE_FILE,
  getStateFile,
  readTemplateState,
  writeTemplateState,
  cleanPrivateVariables,
  getSkipPaths,
} from './core/tracking';

// Git utilities
export {
  getDiff,
  displayDiff,
  isGitRepo,
  isRepoClean,
  applyPatch,
  isProjectUpdated,
} from './utils/git';
