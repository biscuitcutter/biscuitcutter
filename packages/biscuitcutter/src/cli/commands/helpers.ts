import {
  BiscuitCutterError,
  UndefinedVariableInTemplateError,
} from '../../utils/exceptions';
import { getLogger } from '../../utils/log';

const logger = getLogger('biscuitcutter.cli');

export function logSuccess(message: string): void { console.log('\x1b[32m%s\x1b[0m', message); }
export function logWarning(message: string): void { console.log('\x1b[33m%s\x1b[0m', message); }
export function logError(message: string): void { console.log('\x1b[31m%s\x1b[0m', message); }

export function handleCommandError(e: unknown): void {
  if (e instanceof UndefinedVariableInTemplateError) {
    console.error(e.message);
    console.error(`Error message: ${e.error.message}`);
    // Log full context only at debug level to avoid leaking sensitive values
    logger.debug('Context: %s', JSON.stringify(e.context, null, 4));
    process.exit(1);
  } else if (e instanceof BiscuitCutterError) {
    console.error(e.message);
    process.exit(1);
  } else {
    throw e;
  }
}

export function parseExtraContext(items: string[] | undefined): Record<string, any> | null {
  if (!items) return null;
  const extraContext: Record<string, any> = {};
  for (const item of items) {
    if (!item.includes('=')) {
      console.error(`Extra context should be in key=value format; '${item}' is invalid`);
      process.exit(1);
    }
    const [key, ...rest] = item.split('=');
    extraContext[key] = rest.join('=');
  }
  return extraContext;
}
