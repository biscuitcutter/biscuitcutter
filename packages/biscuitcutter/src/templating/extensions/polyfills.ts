/**
 * Python-like string method polyfills for Jinja2 compatibility.
 */

import * as nunjucks from 'nunjucks';

let polyfillsApplied = false;

/**
 * Apply Python-like methods to String.prototype for Jinja2 template compatibility.
 * Methods are only added if they don't already exist.
 */
export function registerPolyfills(): void {
  if (polyfillsApplied) return;

  const defineMethod = (name: string, fn: any) => {
    if (!Object.hasOwn(String.prototype, name)) {
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(String.prototype, name, {
        value: fn,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    }
  };

  defineMethod('lower', function (this: string) { return this.toLowerCase(); });
  defineMethod('upper', function (this: string) { return this.toUpperCase(); });
  defineMethod('capitalize', function (this: string) {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
  });
  defineMethod('title', function (this: string) {
    return this.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  });
  const stripChars = (str: string, chars: string, mode: 'both' | 'left' | 'right'): string => {
    const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = { both: `^[${escaped}]+|[${escaped}]+$`, left: `^[${escaped}]+`, right: `[${escaped}]+$` };
    return str.replace(new RegExp(patterns[mode], 'g'), '');
  };
  defineMethod('strip', function (this: string, chars?: string) {
    return chars ? stripChars(this, chars, 'both') : this.trim();
  });
  defineMethod('lstrip', function (this: string, chars?: string) {
    return chars ? stripChars(this, chars, 'left') : this.trimStart();
  });
  defineMethod('rstrip', function (this: string, chars?: string) {
    return chars ? stripChars(this, chars, 'right') : this.trimEnd();
  });
  defineMethod('startswith', function (this: string, str: string) { return this.startsWith(str); });
  defineMethod('endswith', function (this: string, str: string) { return this.endsWith(str); });

  // Jinja2 .split() without arguments splits by whitespace and filters out empty strings.
  const originalSplit = String.prototype.split;
  defineMethod('split_jinja', function (this: string, separator?: string | RegExp, limit?: number) {
    if (separator === undefined) {
      return this.trim().split(/\s+/);
    }
    return originalSplit.call(this, separator as any, limit);
  });

  // We can't safely override String.prototype.split permanently globally because it breaks JS apps.
  // We handle replace & split inside the env.renderString proxy wrapper safely!

  polyfillsApplied = true;
}

/**
 * Patch nunjucks runtime so null values render as 'None' (Jinja2 behaviour)
 * rather than throwing when throwOnUndefined is enabled.
 */
export function patchNunjucksRuntime(): void {
  if ((nunjucks as any).runtime?.ensureDefined) {
    const original = (nunjucks as any).runtime.ensureDefined;
    (nunjucks as any).runtime.ensureDefined = function (val: any, lineno: number, colno: number) {
      return val === null ? 'None' : original(val, lineno, colno);
    };
  }
}

/**
 * Wrap env.renderString to temporarily apply Python-compatible replace/split
 * semantics and normalise raw block modifiers during rendering.
 *
 * WARNING: This temporarily mutates String.prototype.replace and .split globally.
 * This is safe only because Nunjucks rendering is synchronous — no other code
 * runs while the patched methods are in effect.
 */
export function wrapRenderString(env: nunjucks.Environment): void {
  const originalRenderString = env.renderString.bind(env);
  env.renderString = function (templateStr: string, renderContext?: any) {
    // Nunjucks doesn't natively support modifier dashes on `raw` blocks (e.g. `{%- raw -%}` or `{% endraw -%}`)
    // This strips out any surrounding modifier combinations so it acts as standard block tags to prevent crash.
    const normalizedStr = templateStr
      .replace(/{%-?\s*raw\s*-?%}/g, '{% raw %}')
      .replace(/{%-?\s*endraw\s*-?%}/g, '{% endraw %}');

    const originalReplace = String.prototype.replace;
    const originalSplit = String.prototype.split;
    try {
      (String.prototype as any).replace = function (this: string, ...args: any[]) {
        const [searchValue, ...rest] = args;
        if (typeof searchValue === 'string') {
          return this.split(searchValue).join(rest[0] as string);
        }
        return originalReplace.apply(this, args as any);
      };

      (String.prototype as any).split = function (this: string, separator?: string | RegExp, limit?: number) {
        if (separator === undefined) {
          return this.trim().split(/\s+/);
        }
        return originalSplit.call(this, separator as any, limit);
      };

      return originalRenderString(normalizedStr, renderContext);
    } finally {
      (String.prototype as any).replace = originalReplace;
      (String.prototype as any).split = originalSplit;
    }
  } as any;
}
