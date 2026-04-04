/**
 * Module for setting up logging.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4,
};

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

let currentLevel: LogLevel = 'INFO';
let debugFileStream: import('fs').WriteStream | null = null;

type ConsoleFn = 'log' | 'warn' | 'error';

const LEVELS: Array<{ level: LogLevel; label: string; consoleFn: ConsoleFn }> = [
  { level: 'DEBUG', label: 'DEBUG', consoleFn: 'log' },
  { level: 'INFO', label: 'INFO', consoleFn: 'log' },
  { level: 'WARNING', label: 'WARNING', consoleFn: 'warn' },
  { level: 'ERROR', label: 'ERROR', consoleFn: 'error' },
];

function formatMessage(label: string, name: string, message: string, args: any[]): string {
  let formatted = message;
  for (const arg of args) {
    formatted = formatted.replace(/%[sdifoO]/, String(arg));
  }
  return currentLevel === 'DEBUG' ? `${label} ${name}: ${formatted}` : `${label}: ${formatted}`;
}

function emit(level: LogLevel, label: string, name: string, consoleFn: ConsoleFn, message: string, args: any[]): void {
  const formatted = formatMessage(label, name, message, args);
  debugFileStream?.write(`${formatted}\n`);
  if (LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel]) {
    console[consoleFn](formatted);
  }
}

export function getLogger(name: string): Logger {
  const createLogFn = ({ level, label, consoleFn }: typeof LEVELS[number]) => (
    (message: string, ...args: any[]) => emit(level, label, name, consoleFn, message, args)
  );
  const [debug, info, warn, error] = LEVELS.map(createLogFn);
  return {
    debug, info, warn, error,
  };
}

/**
 * Configure logging for biscuitcutter.
 *
 * Set up logging to stdout with given level. If `debugFile` is given set
 * up logging to file with DEBUG level.
 */
export function configureLogger(
  streamLevel: LogLevel = 'DEBUG',
  debugFile?: string | null,
): void {
  currentLevel = streamLevel;

  if (debugFile) {
    const fs = require('fs');
    debugFileStream = fs.createWriteStream(debugFile, { flags: 'a' });
  }
}
