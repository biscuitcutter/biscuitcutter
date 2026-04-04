/**
 * Helper functions used throughout BiscuitCutter.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fsExtra from 'fs-extra';
import * as nunjucks from 'nunjucks';
import { getLogger } from './log';
import { createStrictEnvironment } from '../templating';

const logger = getLogger('biscuitcutter.utils');

/**
 * Remove a directory and all its contents. Like `rm -rf` on Unix.
 */
export function rmtree(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Ensure that a directory exists.
 */
export function makeSurePathExists(dirPath: string): void {
  logger.debug('Making sure path exists (creates tree if not exist): %s', dirPath);
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error: any) {
    throw new Error(`Unable to create directory at ${dirPath}: ${error.message}`);
  }
}

/**
 * Context manager equivalent: change to a directory, run a function, then change back.
 */
export function workIn<T>(dirname: string | null, fn: () => T): T {
  const curdir = process.cwd();
  try {
    if (dirname !== null) {
      process.chdir(dirname);
    }
    return fn();
  } finally {
    process.chdir(curdir);
  }
}

/**
 * Make `scriptPath` executable.
 */
export function makeExecutable(scriptPath: string): void {
  const stat = fs.statSync(scriptPath);
  fs.chmodSync(scriptPath, stat.mode | 0o100); // S_IEXEC
}

/**
 * Create a temporary dir with a copy of the contents of repoDir.
 */
export function createTmpRepoDir(repoDir: string): string {
  const resolvedRepoDir = path.resolve(repoDir);
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-'));
  const newDir = path.join(baseDir, path.basename(resolvedRepoDir));
  logger.debug('Copying repo_dir from %s to %s', resolvedRepoDir, newDir);
  fsExtra.copySync(resolvedRepoDir, newDir, { dereference: false });
  return newDir;
}

/**
 * Create a nunjucks environment using the provided context.
 */
export function createEnvWithContext(context: Record<string, any>): nunjucks.Environment {
  const envVars = context.biscuitcutter?._jinja2_env_vars || {};
  return createStrictEnvironment({ context, ...envVars });
}
