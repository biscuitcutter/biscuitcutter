/**
 * Nunjucks extensions (filters and globals) — TypeScript equivalents of Jinja2 extensions.
 */

import type * as nunjucks from 'nunjucks';
import type { Logger } from '../../utils/log.js';

import { registerPolyfills } from './polyfills.js';
import { registerTags } from './tags.js';
import { registerFilters } from './filters.js';
import { registerGlobals } from './globals.js';

/**
 * Register all default extensions (filters and globals) on the given environment.
 */
export function registerDefaultExtensions(env: nunjucks.Environment): void {
  registerPolyfills();
  registerTags(env);
  registerFilters(env);
  registerGlobals(env);
}

/**
 * Warn if the context requests Python Jinja2 extensions that cannot be loaded in Nunjucks.
 */
export function warnAboutIncompatibleExtensions(ctx: Record<string, any>, logger: Logger): void {
  try {
    const extensions = ctx.biscuitcutter?._extensions;
    if (Array.isArray(extensions) && extensions.length > 0) {
      logger.warn(
        'Python Jinja2 extensions are not directly supported in Nunjucks: %s',
        extensions.map(String).join(', '),
      );
    }
  } catch {
    // ignore
  }
}
