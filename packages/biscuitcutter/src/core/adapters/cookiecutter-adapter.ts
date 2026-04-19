/**
 * Adapter for Cookiecutter and BiscuitCutter template formats.
 *
 * Wraps the existing Cookiecutter/BiscuitCutter behavior behind the
 * TemplateAdapter interface for use in the unified template pipeline.
 */

import * as fs from 'fs';
import * as nunjucks from 'nunjucks';
import { getLogger } from '../../utils/log';
import {
  TemplateAdapter,
  TemplateConfig,
  TemplateType,
  TemplateVariable,
} from './types';
import { findTemplate } from '../find';
import { createStrictEnvironment } from '../../templating';
import { writeTemplateState, TemplateState } from '../tracking';
import { filterPublicContext, findContextFile } from '../template-helpers';

const logger = getLogger('biscuitcutter.adapters.cookiecutter');

/**
 * Simple glob/fnmatch implementation matching the one in generate.ts.
 */
function minimatch(filepath: string, pattern: string): boolean {
  let regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  regexStr = `^${regexStr}$`;
  return new RegExp(regexStr).test(filepath);
}

/* eslint-disable class-methods-use-this -- methods implement TemplateAdapter interface */
export class CookiecutterAdapter implements TemplateAdapter {
  readonly type: TemplateType;

  constructor(type: TemplateType = 'cookiecutter') {
    this.type = type;
  }

  loadConfig(repoDir: string): TemplateConfig {
    const contextFile = findContextFile(repoDir);
    let rawContext: Record<string, any> = {};

    try {
      const content = fs.readFileSync(contextFile, 'utf-8');
      rawContext = JSON.parse(content);
    } catch {
      logger.debug('Could not read context file %s', contextFile);
    }

    const variables: TemplateVariable[] = [];
    const copyWithoutRender: string[] = rawContext._copy_without_render || [];
    const envOps: Record<string, any> = rawContext._jinja2_env_vars || {};

    for (const [key, value] of Object.entries(rawContext)) {
      if (key.startsWith('_')) continue;

      let varType: TemplateVariable['type'] = 'str';
      if (typeof value === 'boolean') {
        varType = 'bool';
      } else if (Array.isArray(value)) {
        if (value.length > 0 && Array.isArray(value[0])) {
          varType = 'multichoice';
        } else {
          varType = 'choice';
        }
      } else if (typeof value === 'object' && value !== null) {
        varType = 'dict';
      }

      variables.push({
        name: key,
        type: varType,
        default: value,
      });
    }

    return {
      variables,
      rawContext,
      templatesSuffix: null,
      envOps,
      exclude: [],
      skipIfExists: [],
      subdirectory: null,
      tasks: [],
      copyWithoutRender,
      answersFile: null,
    };
  }

  getTemplateDir(repoDir: string): string {
    return findTemplate(repoDir);
  }

  shouldRenderFile(filePath: string, config: TemplateConfig): boolean {
    // Cookiecutter renders all files except those matching _copy_without_render
    for (const pattern of config.copyWithoutRender) {
      if (minimatch(filePath, pattern)) {
        return false;
      }
    }
    return true;
  }

  getOutputFileName(filePath: string): string {
    return filePath;
  }

  buildContext(
    variables: Record<string, any>,
    metadata?: Record<string, any>,
  ): Record<string, any> {
    const context: Record<string, any> = {
      biscuitcutter: { ...variables },
    };
    if (metadata) {
      Object.assign(context.biscuitcutter, metadata);
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
    return createStrictEnvironment({
      context,
      searchPaths,
      ...config.envOps,
    });
  }

  writeStateFile(
    projectDir: string,
    template: string,
    commit: string,
    checkout: string | null,
    context: Record<string, any>,
    directory: string | null,
  ): void {
    const filteredContext = filterPublicContext(
      context.biscuitcutter || context,
    );
    const state: TemplateState = {
      template,
      commit,
      checkout,
      context: filteredContext,
      directory,
    };
    writeTemplateState(projectDir, state);
  }

  renderOutputDirName(
    templateDirName: string,
    context: Record<string, any>,
    env: nunjucks.Environment,
  ): string {
    return env.renderString(templateDirName, context);
  }
}
