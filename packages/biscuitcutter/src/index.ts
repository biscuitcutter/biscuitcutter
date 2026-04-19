/**
 * BiscuitCutter - A TypeScript port of Cookiecutter.
 *
 * A command-line utility that creates projects from project templates.
 */

// Core business logic
export { biscuitcutter, BiscuitCutterOptions } from './core/main';
export {
  generateContext, generateFiles, generateFile, generateFilesWithAdapter,
} from './core/generate';
export {
  promptForConfig, promptForConfigWithAdapter, chooseNestedTemplate, renderVariable,
} from './core/prompt';
export { dump as replayDump, load as replayLoad } from './core/replay';
export { findTemplate } from './core/find';

// Template adapters
export {
  TemplateType,
  TemplateAdapter,
  TemplateConfig,
  TemplateVariable,
  TemplateTask,
} from './core/adapters/types';
export {
  detectTemplateType,
  createAdapter,
  createAdapterForRepo,
  repositoryHasTemplateConfig,
} from './core/adapters/detect';
export { CookiecutterAdapter } from './core/adapters/cookiecutter-adapter';
export { CopierAdapter } from './core/adapters/copier-adapter';

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
