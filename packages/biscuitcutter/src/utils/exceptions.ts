/**
 * All exceptions used in the BiscuitCutter code base are defined here.
 */

/** Base exception class. All BiscuitCutter-specific exceptions should extend this. */
export class BiscuitCutterError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Exception for when a project's input dir is not templated.
 * The name of the input directory should always contain a string that is
 * rendered to something else, so that input_dir != output_dir.
 */
export class NonTemplatedInputDirError extends BiscuitCutterError {}

/**
 * Exception for missing config file.
 * Raised when getConfig() is passed a path to a config file, but no file
 * is found at that path.
 */
export class ConfigDoesNotExistError extends BiscuitCutterError {}

/**
 * Exception for invalid configuration file.
 * Raised if the global configuration file is not valid YAML or is
 * badly constructed.
 */
export class InvalidConfigurationError extends BiscuitCutterError {}

/**
 * Exception for unknown repo types.
 * Raised if a repo's type cannot be determined.
 */
export class UnknownRepoTypeError extends BiscuitCutterError {}

/**
 * Exception when version control is unavailable.
 * Raised if the version control system (git or hg) is not installed.
 */
export class VCSNotInstalledError extends BiscuitCutterError {}

/**
 * Exception for failed JSON decoding.
 * Raised when a project's JSON context file can not be decoded.
 */
export class ContextDecodingError extends BiscuitCutterError {}

/**
 * Exception for existing output directory.
 * Raised when the output directory of the project exists already.
 */
export class OutputDirExistsError extends BiscuitCutterError {}

/**
 * Exception for an empty directory name.
 * Raised when the directory name provided is empty.
 */
export class EmptyDirNameError extends BiscuitCutterError {}

/**
 * Exception for incompatible modes.
 * Raised when biscuitcutter is called with both `noInput==true` and
 * `replay==true` at the same time.
 */
export class InvalidModeError extends BiscuitCutterError {}

/**
 * Exception for hook failures.
 * Raised when a hook script fails.
 */
export class FailedHookError extends BiscuitCutterError {}

/**
 * Exception for out-of-scope variables.
 * Raised when a template uses a variable which is not defined in the context.
 */
export class UndefinedVariableInTemplateError extends BiscuitCutterError {
  public error: Error;

  public context: Record<string, any>;

  constructor(message: string, error: Error, context: Record<string, any>) {
    super(message);
    this.error = error;
    this.context = context;
  }

  toString(): string {
    return (
      `${this.message}. `
      + `Error message: ${this.error.message}. `
      + `Context: ${JSON.stringify(this.context)}`
    );
  }
}

/**
 * Exception for un-importable extension.
 * Raised when an environment is unable to import a required extension.
 */
export class UnknownExtensionError extends BiscuitCutterError {}

/**
 * Exception for missing repo.
 * Raised when the specified biscuitcutter repository doesn't exist.
 */
export class RepositoryNotFoundError extends BiscuitCutterError {}

/**
 * Exception for un-cloneable repo.
 * Raised when a biscuitcutter template can't be cloned.
 */
export class RepositoryCloneFailedError extends BiscuitCutterError {}

/**
 * Exception for bad zip repo.
 * Raised when the specified biscuitcutter repository isn't a valid Zip archive.
 */
export class InvalidZipRepositoryError extends BiscuitCutterError {}

// ==========================================
// Template tracking exceptions
// ==========================================

/**
 * Exception for when no .biscuitcutter.json state file is found.
 * Raised when template tracking operations require an existing state file.
 */
export class TemplateStateNotFoundError extends BiscuitCutterError {
  public directory: string;

  constructor(directory: string) {
    super(`Unable to locate a \`.biscuitcutter.json\` state file in \`${directory}\``);
    this.directory = directory;
  }
}

/**
 * Exception for when .biscuitcutter.json already exists.
 * Raised when attempting to create a new state file but one already exists.
 */
export class TemplateStateExistsError extends BiscuitCutterError {
  public fileLocation: string;

  constructor(fileLocation: string) {
    super(`\`.biscuitcutter.json\` is already defined at \`${fileLocation}\``);
    this.fileLocation = fileLocation;
  }
}

/**
 * Exception for when unable to find a cookiecutter template.
 * Raised when unable to locate a valid cookiecutter template in a directory.
 */
export class UnableToFindCookiecutterTemplateError extends BiscuitCutterError {
  public directory: string;

  constructor(directory: string) {
    super(`Unable to locate a Cookiecutter template in \`${directory}\``);
    this.directory = directory;
  }
}

/**
 * Exception for unicode decoding errors in changesets.
 * Raised when the diff contains characters that cannot be decoded as UTF-8.
 */
export class ChangesetUnicodeError extends BiscuitCutterError {
  constructor() {
    super('The changeset contains characters that cannot be decoded as UTF-8');
  }
}

/**
 * Exception for dirty git working directory.
 * Raised when cruft update is attempted on an unclean git repository.
 */
export class DirtyGitRepositoryError extends BiscuitCutterError {
  constructor(message: string = 'Cannot apply updates on an unclean git project') {
    super(message);
  }
}

/**
 * Exception for path traversal attempts.
 * Raised when a rendered path would escape the intended output directory.
 */
export class PathTraversalError extends BiscuitCutterError {
  public attemptedPath: string;

  public boundaryDir: string;

  constructor(attemptedPath: string, boundaryDir: string) {
    super(`Path traversal detected: '${attemptedPath}' would escape output directory '${boundaryDir}'`);
    this.attemptedPath = attemptedPath;
    this.boundaryDir = boundaryDir;
  }
}
