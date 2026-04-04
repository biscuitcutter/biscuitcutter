/**
 * Nunjucks Extension for {% now %} tag (Jinja2 compatible).
 * Usage: {% now 'utc', '%Y-%m-%d' %} or {% now 'local', '%Y' %}
 */

import * as nunjucks from 'nunjucks';
import { nowGlobal } from './globals.js';

export class NowExtension implements nunjucks.Extension {
  tags = ['now'];

  parse(parser: any, nodes: any, _lexer: any): any {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);

    return new nodes.CallExtension(this, 'run', args, null);
  }

  // eslint-disable-next-line class-methods-use-this
  run(_context: any, ...args: any[]): string {
    // Filter out the callback function that Nunjucks adds
    const filteredArgs = args.filter((arg) => typeof arg !== 'function');

    // Parse arguments: {% now 'utc', '%Y' %} or {% now '%Y' %}
    if (filteredArgs.length >= 2) {
      // timezone (ignored), format
      return nowGlobal(undefined, filteredArgs[1]);
    }
    // Single arg: could be timezone or format string
    return nowGlobal(filteredArgs[0]);
  }
}
