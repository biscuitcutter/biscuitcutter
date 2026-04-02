/**
 * Nunjucks global function implementations for Jinja2 compatibility.
 */

import type * as nunjucks from 'nunjucks';
import { randomUUID } from 'crypto';
import { strftime } from './strftime.js';

/**
 * UUID4 global - generates a random UUID.
 */
export function uuid4(): string {
  return randomUUID();
}

/**
 * Random ASCII string global - generates a random string of ASCII characters.
 */
export function randomAsciiString(length: number, punctuation: boolean = false): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const punct = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
  const corpus = punctuation ? letters + punct : letters;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += corpus.charAt(Math.floor(Math.random() * corpus.length));
  }
  return result;
}

/**
 * Now global - provides current date formatting.
 * Handles both positional args and Nunjucks keyword args (passed as object with __keywords: true)
 */
export function nowGlobal(timezoneOrKwargs?: string | Record<string, any>, format?: string): string {
  let fmt = '%Y-%m-%d';

  // Check if first arg is Nunjucks keyword arguments object
  if (timezoneOrKwargs && typeof timezoneOrKwargs === 'object' && timezoneOrKwargs.__keywords) {
    fmt = timezoneOrKwargs.format || fmt;
  } else if (format) {
    fmt = format;
  } else if (typeof timezoneOrKwargs === 'string' && timezoneOrKwargs.startsWith('%')) {
    // First positional arg looks like a format string
    fmt = timezoneOrKwargs;
  }

  return strftime(fmt, new Date());
}

/**
 * Register all globals on the given Nunjucks environment.
 */
export function registerGlobals(env: nunjucks.Environment): void {
  env.addGlobal('uuid4', uuid4);
  env.addGlobal('random_ascii_string', randomAsciiString);
  env.addGlobal('now', nowGlobal);
}
