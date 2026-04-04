/**
 * Nunjucks tag extensions for Jinja2 compatibility.
 */

import type * as nunjucks from 'nunjucks';
import { NowExtension } from './now-tag.js';

/**
 * Register all tag extensions on the given Nunjucks environment.
 */
export function registerTags(env: nunjucks.Environment): void {
  env.addExtension('NowExtension', new NowExtension());
}
