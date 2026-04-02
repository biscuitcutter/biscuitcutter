/**
 * Nunjucks filter implementations for Jinja2 compatibility.
 */

import type * as nunjucks from 'nunjucks';

/**
 * Jsonify filter - converts object to JSON string with sorted keys.
 */
export function jsonifyFilter(obj: any, indent: number = 4): string {
  if (typeof obj !== 'object' || obj === null) {
    return JSON.stringify(obj, null, indent);
  }
  return JSON.stringify(obj, Object.keys(obj).sort(), indent);
}

/**
 * Slugify filter - converts string to URL-friendly slug.
 */
export function slugifyFilter(value: string, options?: Record<string, any>): string {
  let slug = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (options?.maxLength && options.maxLength > 0) {
    slug = slug.substring(0, options.maxLength);
  }

  return slug;
}

/**
 * Map filter - Jinja2-compatible map filter for arrays.
 * Can map by attribute name or apply a filter to each element.
 */
export function createMapFilter(env: nunjucks.Environment) {
  return (arr: any[], filterNameOrAttr?: string | Record<string, any>, ...args: any[]) => {
    if (!Array.isArray(arr)) return arr;

    // Handle keyword arguments e.g. map(attribute='name')
    if (
      filterNameOrAttr
      && typeof filterNameOrAttr === 'object'
      && filterNameOrAttr.__keywords
    ) {
      const attr = filterNameOrAttr.attribute;
      if (attr) {
        return arr.map((item: any) => item?.[attr]);
      }
      return arr;
    }

    const prop = filterNameOrAttr as string;

    try {
      const filter = env.getFilter(prop);
      if (filter) {
        return arr.map((item) => filter(item, ...args));
      }
    } catch {
      // filter not found, fallback to attribute
    }

    return arr.map((item: any) => item?.[prop]);
  };
}

/**
 * Register all filters on the given Nunjucks environment.
 */
export function registerFilters(env: nunjucks.Environment): void {
  env.addFilter('jsonify', jsonifyFilter);
  env.addFilter('slugify', slugifyFilter);
  env.addFilter('map', createMapFilter(env));
}
