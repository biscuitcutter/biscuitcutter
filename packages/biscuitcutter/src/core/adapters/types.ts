/**
 * Template adapter types and interfaces.
 *
 * These types define the contract between different template formats
 * (Cookiecutter, BiscuitCutter, Copier) and the core generation pipeline.
 */

import * as nunjucks from 'nunjucks';

export type TemplateType = 'cookiecutter' | 'biscuitcutter' | 'copier';

/**
 * A normalized template variable definition.
 */
export interface TemplateVariable {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'json' | 'yaml' | 'choice' | 'multichoice' | 'dict';
  default: any;
  help?: string;
  choices?: Array<{ value: any; label?: string }>;
  when?: string;
  validator?: string;
  secret?: boolean;
  multiline?: boolean;
  multiselect?: boolean;
  placeholder?: string;
}

/**
 * A task to run during template generation (Copier's _tasks equivalent).
 */
export interface TemplateTask {
  command: string | string[];
  when?: string;
  workingDirectory?: string;
}

/**
 * Normalized template configuration parsed from any supported format.
 */
export interface TemplateConfig {
  /** The raw variables/context from the template config file. */
  variables: TemplateVariable[];
  /** The raw context object for backward compatibility. */
  rawContext: Record<string, any>;
  /** File suffix that indicates a file should be rendered (e.g., '.jinja' for Copier, null for Cookiecutter). */
  templatesSuffix: string | null;
  /** Custom Jinja2/Nunjucks environment options. */
  envOps: Record<string, any>;
  /** File patterns to exclude entirely from output. */
  exclude: string[];
  /** File patterns to skip if they already exist in the output. */
  skipIfExists: string[];
  /** Subdirectory within the repo that contains the actual template. */
  subdirectory: string | null;
  /** Tasks to run after generation. */
  tasks: TemplateTask[];
  /** Patterns for files that should be copied without rendering (Cookiecutter's _copy_without_render). */
  copyWithoutRender: string[];
  /** Path where answers/state should be written. */
  answersFile: string | null;
}

/**
 * Interface that all template format adapters must implement.
 */
export interface TemplateAdapter {
  /** The template format type. */
  readonly type: TemplateType;

  /**
   * Parse the template config file and return a normalized TemplateConfig.
   */
  loadConfig(repoDir: string): TemplateConfig;

  /**
   * Return the directory containing template files to render.
   * For Cookiecutter/BiscuitCutter: the specially-named subdirectory (e.g., {{cookiecutter.project_slug}}).
   * For Copier: the repo root or _subdirectory.
   */
  getTemplateDir(repoDir: string, config: TemplateConfig): string;

  /**
   * Determine whether a given file should be rendered through the template engine.
   * For Cookiecutter/BiscuitCutter: true for all files (except _copy_without_render).
   * For Copier: true only for files with the _templates_suffix (e.g., .jinja).
   */
  shouldRenderFile(filePath: string, config: TemplateConfig): boolean;

  /**
   * Transform the file path for output (e.g., strip .jinja suffix for Copier).
   */
  getOutputFileName(filePath: string, config: TemplateConfig): string;

  /**
   * Build the context object used for template rendering.
   * For Cookiecutter/BiscuitCutter: wraps variables under { biscuitcutter: { ... } }.
   * For Copier: flat object with direct variable access.
   */
  buildContext(variables: Record<string, any>, metadata?: Record<string, any>): Record<string, any>;

  /**
   * Get file patterns that should be excluded entirely from output.
   */
  getExcludePatterns(config: TemplateConfig): string[];

  /**
   * Create a Nunjucks environment configured for this template format.
   */
  createEnvironment(config: TemplateConfig, context: Record<string, any>, searchPaths?: string[]): nunjucks.Environment;

  /**
   * Write the template state/answers file to the generated project directory.
   */
  writeStateFile(
    projectDir: string,
    template: string,
    commit: string,
    checkout: string | null,
    context: Record<string, any>,
    directory: string | null,
  ): void;

  /**
   * Render the output directory name from the template directory name.
   * For Cookiecutter: renders {{cookiecutter.project_slug}} → my-project.
   * For Copier: uses a configured project name or the repo name.
   */
  renderOutputDirName(
    templateDirName: string,
    context: Record<string, any>,
    env: nunjucks.Environment,
  ): string;
}
