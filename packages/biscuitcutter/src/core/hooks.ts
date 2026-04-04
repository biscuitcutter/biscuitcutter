/**
 * Functions for discovering and executing various biscuitcutter hooks.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import * as os from 'os';
import { getLogger } from '../utils/log';
import { FailedHookError } from '../utils/exceptions';
import {
  createEnvWithContext,
  createTmpRepoDir,
  makeExecutable,
  rmtree,
  workIn,
} from '../utils/utils';

const logger = getLogger('biscuitcutter.hooks');

const HOOKS = ['pre_prompt', 'pre_gen_project', 'post_gen_project'];
const EXIT_SUCCESS = 0;

/**
 * Determine if a hook file is valid.
 */
export function validHook(hookFile: string, hookName: string): boolean {
  const filename = path.basename(hookFile);
  const ext = path.extname(filename);
  const basename = filename.slice(0, filename.length - ext.length);
  const matchingHook = basename === hookName;
  const supportedHook = HOOKS.includes(basename);
  const backupFile = filename.endsWith('~');

  return matchingHook && supportedHook && !backupFile;
}

/**
 * Return a list of all valid hook scripts for the given hook name.
 *
 * Must be called with the project template as the current working directory.
 */
export function findHook(
  hookName: string,
  hooksDir: string = 'hooks',
): string[] | null {
  logger.debug('hooks_dir is %s', path.resolve(hooksDir));

  if (!fs.existsSync(hooksDir) || !fs.statSync(hooksDir).isDirectory()) {
    logger.debug('No hooks/dir in template_dir');
    return null;
  }

  const scripts = fs
    .readdirSync(hooksDir)
    .filter((hookFile) => validHook(hookFile, hookName))
    .map((hookFile) => path.resolve(path.join(hooksDir, hookFile)));

  if (scripts.length === 0) {
    return null;
  }
  return scripts;
}

/**
 * Execute a script from a working directory.
 */
export function runScript(scriptPath: string, cwd: string = '.'): void {
  const isWindows = process.platform === 'win32';

  let scriptCommand: string[];
  if (scriptPath.endsWith('.js') || scriptPath.endsWith('.ts')) {
    scriptCommand = [process.execPath, scriptPath];
  } else if (scriptPath.endsWith('.py')) {
    scriptCommand = ['python3', scriptPath];
  } else {
    scriptCommand = [scriptPath];
  }

  makeExecutable(scriptPath);

  try {
    if (isWindows) {
      // Use spawnSync with shell:true on Windows to handle script execution
      // while avoiding command injection by passing args as array
      const result = spawnSync(scriptCommand[0], scriptCommand.slice(1), {
        cwd,
        stdio: 'inherit',
        shell: true,
      });
      if (result.error) {
        throw result.error;
      }
      if (result.status !== EXIT_SUCCESS) {
        const err = new Error('Script failed') as any;
        err.status = result.status;
        throw err;
      }
    } else {
      execFileSync(scriptCommand[0], scriptCommand.slice(1), {
        cwd,
        stdio: 'inherit',
      });
    }
  } catch (err: any) {
    if (err.status !== undefined && err.status !== EXIT_SUCCESS) {
      throw new FailedHookError(
        `Hook script failed (exit status: ${err.status})`,
      );
    }
    if (err.code === 'ENOEXEC') {
      throw new FailedHookError(
        'Hook script failed, might be an empty file or missing a shebang',
      );
    }
    throw new FailedHookError(`Hook script failed (error: ${err.message})`);
  }
}

/**
 * Execute a script after rendering it with Nunjucks.
 */
export function runScriptWithContext(
  scriptPath: string,
  cwd: string,
  context: Record<string, any>,
): void {
  const ext = path.extname(scriptPath);
  const contents = fs.readFileSync(scriptPath, 'utf-8');

  const env = createEnvWithContext(context);
  const output = env.renderString(contents, context);

  const tmpFile = path.join(
    os.tmpdir(),
    `biscuitcutter-hook-${Date.now()}${ext}`,
  );
  fs.writeFileSync(tmpFile, output, 'utf-8');

  try {
    runScript(tmpFile, cwd);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Try to find and execute a hook from the specified project directory.
 */
export function runHook(
  hookName: string,
  projectDir: string,
  context: Record<string, any>,
): void {
  const scripts = findHook(hookName);
  if (!scripts) {
    logger.debug('No %s hook found', hookName);
    return;
  }
  logger.debug('Running hook %s', hookName);
  for (const script of scripts) {
    runScriptWithContext(script, projectDir, context);
  }
}

/**
 * Run hook from repo directory, clean project directory if hook fails.
 */
export function runHookFromRepoDir(
  repoDir: string,
  hookName: string,
  projectDir: string,
  context: Record<string, any>,
  deleteProjectOnFailure: boolean,
): void {
  workIn(repoDir, () => {
    try {
      runHook(hookName, projectDir, context);
    } catch (err) {
      if (deleteProjectOnFailure) {
        rmtree(projectDir);
      }
      logger.error(
        "Stopping generation because %s hook script didn't exit successfully",
        hookName,
      );
      throw err;
    }
  });
}

/**
 * Run pre_prompt hook from repo directory.
 */
export function runPrePromptHook(repoDir: string): string {
  // Check if we have a valid pre_prompt script
  const scripts = workIn(repoDir, () => findHook('pre_prompt'));
  if (!scripts) {
    return repoDir;
  }

  // Create a temporary directory
  const tmpRepoDir = createTmpRepoDir(repoDir);

  workIn(tmpRepoDir, () => {
    const tmpScripts = findHook('pre_prompt') || [];
    for (const script of tmpScripts) {
      try {
        runScript(script, tmpRepoDir);
      } catch (e: any) {
        throw new FailedHookError('Pre-Prompt Hook script failed');
      }
    }
  });

  return tmpRepoDir;
}
