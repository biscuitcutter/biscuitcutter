/**
 * Adapter for Copier template format.
 *
 * Handles parsing copier.yml/copier.yaml config files, suffix-based file
 * rendering, flat (non-namespaced) variable context, and .copier-answers.yml
 * state tracking.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as nunjucks from 'nunjucks';
import * as YAML from 'yaml';
import { getLogger } from '../../utils/log';
import {
  TemplateAdapter,
  TemplateConfig,
  TemplateTask,
  TemplateType,
  TemplateVariable,
} from './types';
import { createStrictEnvironment } from '../../templating';
import { registerDefaultExtensions } from '../../templating/extensions';
import { patchNunjucksRuntime, wrapRenderString } from '../../templating/extensions/polyfills';

const logger = getLogger('biscuitcutter.adapters.copier');

/** Default suffix for Copier template files. */
const DEFAULT_TEMPLATES_SUFFIX = '.jinja';

/** Default answers file path. */
const DEFAULT_ANSWERS_FILE = '.copier-answers.yml';

/** Copier settings keys (prefixed with underscore). */
const COPIER_SETTINGS_KEYS = new Set([
  '_templates_suffix',
  '_jinja_extensions',
  '_envops',
  '_answers_file',
  '_exclude',
  '_skip_if_exists',
  '_subdirectory',
  '_tasks',
  '_migrations',
  '_version',
  '_min_copier_version',
  '_message_before_copy',
  '_message_after_copy',
  '_message_before_update',
  '_message_after_update',
]);

/**
 * Parse a Copier variable definition from copier.yml.
 *
 * Variables can be defined as simple values or as objects with metadata:
 *   project_name: "default"
 *   project_name:
 *     type: str
 *     default: "default"
 *     help: "Your project name"
 */
function parseCopierVariable(name: string, definition: any): TemplateVariable {
  // Simple value definition (just a default)
  if (definition === null || typeof definition !== 'object' || Array.isArray(definition)) {
    return {
      name,
      type: inferType(definition),
      default: definition,
    };
  }

  // Object definition with metadata
  const typeName = definition.type || inferTypeFromValue(definition.default);
  const variable: TemplateVariable = {
    name,
    type: mapCopierType(typeName),
    default: definition.default !== undefined ? definition.default : null,
  };

  if (definition.help) variable.help = definition.help;
  if (definition.when !== undefined) variable.when = String(definition.when);
  if (definition.validator) variable.validator = definition.validator;
  if (definition.secret) variable.secret = true;
  if (definition.multiline) variable.multiline = true;
  if (definition.placeholder) variable.placeholder = definition.placeholder;

  if (definition.choices) {
    variable.type = definition.multiselect ? 'multichoice' : 'choice';
    variable.multiselect = definition.multiselect || false;

    if (Array.isArray(definition.choices)) {
      variable.choices = definition.choices.map((c: any) => ({
        value: c,
        label: String(c),
      }));
    } else if (typeof definition.choices === 'object') {
      // Dict form: { "Display Label": "actual_value" }
      variable.choices = Object.entries(definition.choices).map(([label, value]) => ({
        value,
        label,
      }));
    }
  }

  return variable;
}

function inferType(value: any): TemplateVariable['type'] {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float';
  }
  if (Array.isArray(value)) return 'choice';
  if (typeof value === 'object' && value !== null) return 'dict';
  return 'str';
}

function inferTypeFromValue(value: any): string {
  if (value === undefined || value === null) return 'str';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  return 'str';
}

function mapCopierType(typeName: string): TemplateVariable['type'] {
  switch (typeName) {
    case 'str': return 'str';
    case 'int': return 'int';
    case 'float': return 'float';
    case 'bool': return 'bool';
    case 'json': return 'json';
    case 'yaml': return 'yaml';
    default: return 'str';
  }
}

/**
 * Parse Copier tasks from _tasks config.
 */
function parseTasks(rawTasks: any[]): TemplateTask[] {
  if (!Array.isArray(rawTasks)) return [];

  return rawTasks.map((task) => {
    if (typeof task === 'string') {
      return { command: task };
    }
    if (Array.isArray(task)) {
      return { command: task };
    }
    if (typeof task === 'object' && task !== null) {
      return {
        command: task.command || task.cmd,
        when: task.when ? String(task.when) : undefined,
        workingDirectory: task.working_directory,
      };
    }
    return { command: String(task) };
  });
}

/**
 * Simple gitignore-style pattern matching.
 */
function matchesExcludePattern(filePath: string, pattern: string): boolean {
  // Handle negation
  if (pattern.startsWith('!')) {
    return false; // Negation patterns are handled by the caller
  }

  // Remove leading slash (anchors to root)
  const cleanPattern = pattern.replace(/^\//, '');

  // Convert gitignore pattern to regex
  let regexStr = cleanPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  // If pattern ends with /, match directory and all contents
  if (regexStr.endsWith('/')) {
    regexStr = `${regexStr}.*`;
  }

  regexStr = `^${regexStr}$`;

  try {
    return new RegExp(regexStr).test(filePath);
  } catch {
    return false;
  }
}

export class CopierAdapter implements TemplateAdapter {
  readonly type: TemplateType = 'copier';

  loadConfig(repoDir: string): TemplateConfig {
    const configPath = this.findConfigFile(repoDir);
    let rawYaml: Record<string, any> = {};

    if (configPath) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        rawYaml = YAML.parse(content) || {};
      } catch (e: any) {
        logger.debug('Error parsing Copier config %s: %s', configPath, e.message);
      }
    }

    // Separate settings (underscore-prefixed) from variables
    const settings: Record<string, any> = {};
    const rawContext: Record<string, any> = {};

    for (const [key, value] of Object.entries(rawYaml)) {
      if (key.startsWith('_')) {
        settings[key] = value;
      } else {
        rawContext[key] = value;
      }
    }

    // Parse variables
    const variables: TemplateVariable[] = [];
    for (const [key, value] of Object.entries(rawContext)) {
      variables.push(parseCopierVariable(key, value));
    }

    // Parse settings
    const templatesSuffix = settings._templates_suffix || DEFAULT_TEMPLATES_SUFFIX;
    const answersFile = settings._answers_file || DEFAULT_ANSWERS_FILE;
    const subdirectory = settings._subdirectory || null;
    const exclude = Array.isArray(settings._exclude) ? settings._exclude : [];
    const skipIfExists = Array.isArray(settings._skip_if_exists) ? settings._skip_if_exists : [];
    const tasks = parseTasks(settings._tasks || []);
    const envOps = settings._envops || {};

    // Always exclude the copier config file and answers file from output
    const defaultExcludes = ['copier.yml', 'copier.yaml', '.copier-answers.yml'];
    const allExcludes = [...new Set([...defaultExcludes, ...exclude])];

    return {
      variables,
      rawContext,
      templatesSuffix,
      envOps,
      exclude: allExcludes,
      skipIfExists,
      subdirectory,
      tasks,
      copyWithoutRender: [],
      answersFile,
    };
  }

  getTemplateDir(repoDir: string, config: TemplateConfig): string {
    if (config.subdirectory) {
      const subdir = path.join(repoDir, config.subdirectory);
      if (fs.existsSync(subdir) && fs.statSync(subdir).isDirectory()) {
        return subdir;
      }
      logger.debug('Configured subdirectory %s not found, using repo root', config.subdirectory);
    }
    return repoDir;
  }

  shouldRenderFile(filePath: string, config: TemplateConfig): boolean {
    const suffix = config.templatesSuffix || DEFAULT_TEMPLATES_SUFFIX;
    return filePath.endsWith(suffix);
  }

  getOutputFileName(filePath: string, config: TemplateConfig): string {
    const suffix = config.templatesSuffix || DEFAULT_TEMPLATES_SUFFIX;
    if (filePath.endsWith(suffix)) {
      return filePath.slice(0, -suffix.length);
    }
    return filePath;
  }

  buildContext(
    variables: Record<string, any>,
    metadata?: Record<string, any>,
  ): Record<string, any> {
    // Copier uses flat context — variables are accessed directly as {{ name }}
    const context: Record<string, any> = { ...variables };
    if (metadata) {
      context._copier_conf = metadata;
    }
    return context;
  }

  getExcludePatterns(config: TemplateConfig): string[] {
    return config.exclude;
  }

  createEnvironment(
    config: TemplateConfig,
    context: Record<string, any>,
    searchPaths?: string[],
  ): nunjucks.Environment {
    const loader = searchPaths
      ? new nunjucks.FileSystemLoader(searchPaths, { noCache: true })
      : null;

    const envOptions: Record<string, any> = {
      autoescape: false,
      throwOnUndefined: true,
      trimBlocks: false,
      lstripBlocks: false,
    };

    // Apply custom _envops (e.g., custom delimiters)
    if (config.envOps) {
      // Map Copier/Jinja2 env options to Nunjucks equivalents
      const mapping: Record<string, string> = {
        block_start_string: 'blockStart',
        block_end_string: 'blockEnd',
        variable_start_string: 'variableStart',
        variable_end_string: 'variableEnd',
        comment_start_string: 'commentStart',
        comment_end_string: 'commentEnd',
        trim_blocks: 'trimBlocks',
        lstrip_blocks: 'lstripBlocks',
        keep_trailing_newline: 'keepTrailingNewline',
      };

      for (const [jinja2Key, nunjucksKey] of Object.entries(mapping)) {
        if (jinja2Key in config.envOps) {
          envOptions[nunjucksKey] = config.envOps[jinja2Key];
        }
      }

      // Also accept Nunjucks-style keys directly
      for (const [key, value] of Object.entries(config.envOps)) {
        if (!key.includes('_') && !(key in envOptions)) {
          envOptions[key] = value;
        }
      }
    }

    const env = new nunjucks.Environment(loader as any, envOptions);
    registerDefaultExtensions(env);
    wrapRenderString(env);

    return env;
  }

  writeStateFile(
    projectDir: string,
    template: string,
    commit: string,
    checkout: string | null,
    context: Record<string, any>,
    directory: string | null,
  ): void {
    // Write .copier-answers.yml
    const answers: Record<string, any> = {
      _src_path: template,
      _commit: commit,
    };
    if (checkout) {
      answers._checkout = checkout;
    }
    if (directory) {
      answers._subdirectory = directory;
    }

    // Add user variables (exclude internal/private keys)
    for (const [key, value] of Object.entries(context)) {
      if (!key.startsWith('_')) {
        answers[key] = value;
      }
    }

    const yamlContent = YAML.stringify(answers, { lineWidth: 0 });
    const header = '# Changes here will be overwritten by Copier/BiscuitCutter\n';
    fs.writeFileSync(
      path.join(projectDir, DEFAULT_ANSWERS_FILE),
      header + yamlContent,
      'utf-8',
    );

    // Also write .biscuitcutter.json for compatibility with the tracking system
    const { filterPublicContext } = require('../template-helpers');
    const { writeTemplateState } = require('../tracking');

    const filteredContext = filterPublicContext(context);
    writeTemplateState(projectDir, {
      template,
      commit,
      checkout,
      context: filteredContext,
      directory,
    });
  }

  renderOutputDirName(
    templateDirName: string,
    context: Record<string, any>,
    env: nunjucks.Environment,
  ): string {
    // For Copier, the template dir is the repo root — the output dir name
    // typically comes from a variable like project_name or project_slug
    return env.renderString(templateDirName, context);
  }

  /**
   * Check if a file path matches any of the exclude patterns.
   */
  isExcluded(filePath: string, config: TemplateConfig): boolean {
    const negationPatterns = config.exclude.filter((p) => p.startsWith('!'));
    const includePatterns = config.exclude.filter((p) => !p.startsWith('!'));

    let excluded = false;
    for (const pattern of includePatterns) {
      if (matchesExcludePattern(filePath, pattern)) {
        excluded = true;
        break;
      }
    }

    if (excluded) {
      for (const pattern of negationPatterns) {
        if (matchesExcludePattern(filePath, pattern.slice(1))) {
          excluded = false;
          break;
        }
      }
    }

    return excluded;
  }

  /**
   * Find the Copier config file in a directory.
   */
  private findConfigFile(repoDir: string): string | null {
    const ymlPath = path.join(repoDir, 'copier.yml');
    if (fs.existsSync(ymlPath)) return ymlPath;

    const yamlPath = path.join(repoDir, 'copier.yaml');
    if (fs.existsSync(yamlPath)) return yamlPath;

    return null;
  }
}
