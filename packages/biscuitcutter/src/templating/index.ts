/**
 * Nunjucks environment and extension loading.
 */

import * as nunjucks from 'nunjucks';
import { getLogger } from '../utils/log';
import { registerDefaultExtensions, warnAboutIncompatibleExtensions } from './extensions';
import { patchNunjucksRuntime, wrapRenderString } from './extensions/polyfills';

const logger = getLogger('biscuitcutter.environment');

patchNunjucksRuntime();

export interface EnvironmentOptions {
  context?: Record<string, any>;
  keepTrailingNewline?: boolean;
  searchPaths?: string | string[];
  [key: string]: any;
}

/**
 * Create a Nunjucks environment with extensions loaded from the context.
 */
export function createStrictEnvironment(options: EnvironmentOptions = {}): nunjucks.Environment {
  const { context, searchPaths, ...envVars } = options;
  const ctx = context || {};

  warnAboutIncompatibleExtensions(ctx, logger);

  const contextEnvVars = ctx.biscuitcutter?._jinja2_env_vars || {};
  const loader = searchPaths
    ? new nunjucks.FileSystemLoader(searchPaths, { noCache: true })
    : null;

  const env = new nunjucks.Environment(loader as any, {
    autoescape: false,
    throwOnUndefined: true,
    trimBlocks: false,
    lstripBlocks: false,
    ...contextEnvVars,
    ...envVars,
  });

  registerDefaultExtensions(env);

  // Add backwards compatibility for templates that use {{ cookiecutter.some_var }}
  if (ctx.biscuitcutter) {
    env.addGlobal('cookiecutter', ctx.biscuitcutter);
  }

  wrapRenderString(env);

  return env;
}

export const VARIABLE_START_STRING = '{{';
export const VARIABLE_END_STRING = '}}';
