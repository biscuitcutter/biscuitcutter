/**
 * Git utilities for biscuitcutter.
 *
 * Provides git operations for version control, diff generation, and patch application.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { ChangesetUnicodeError } from './exceptions';

const DIFF_SRC_PREFIX = 'upstream-template-old';
const DIFF_DST_PREFIX = 'upstream-template-new';

// ==========================================
// Repository Operations
// ==========================================

/**
 * Check if a directory is inside a git repository.
 */
export function isGitRepo(directory: string): boolean {
  try {
    const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: directory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.stdout?.includes('true') || false;
  } catch {
    return false;
  }
}

/**
 * Check if a git working directory is clean.
 */
export function isRepoClean(directory: string, allowUntrackedFiles: boolean = false): boolean {
  if (!isGitRepo(directory)) {
    return true;
  }

  try {
    const result = spawnSync('git', ['status', '--porcelain'], {
      cwd: directory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let statusLines = (result.stdout || '').split('\n').filter((line) => line.trim());

    if (allowUntrackedFiles) {
      statusLines = statusLines.filter((line) => !line.trim().startsWith('??'));
    }

    return statusLines.length === 0;
  } catch {
    return true;
  }
}

/**
 * Get the offset (subdirectory path) within a git repository.
 */
export function getGitOffset(directory: string): string {
  try {
    const result = spawnSync('git', ['rev-parse', '--show-prefix'], {
      cwd: directory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status === 0) {
      return (result.stdout || '').trim();
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Clone a git repository to a directory.
 */
export function cloneRepo(
  templateUrl: string,
  targetDir: string,
  checkout?: string | null,
  shallow: boolean = false,
): string {
  const cloneArgs = ['clone'];

  if (shallow) {
    cloneArgs.push('--filter=blob:none', '--no-checkout');
  }

  cloneArgs.push(templateUrl, targetDir);

  const result = spawnSync('git', cloneArgs, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`Failed to clone repository: ${result.stderr}`);
  }

  if (checkout) {
    const checkoutResult = spawnSync('git', ['checkout', checkout], {
      cwd: targetDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (checkoutResult.status !== 0) {
      throw new Error(`Failed to checkout ${checkout}: ${checkoutResult.stderr}`);
    }
  }

  // Update submodules
  spawnSync('git', ['submodule', 'update', '--init', '--recursive', '--force'], {
    cwd: targetDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return targetDir;
}

/**
 * Get the latest commit hash from a repository.
 */
export function getLatestCommit(repoDir: string): string {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`Failed to get HEAD commit: ${result.stderr}`);
  }

  return result.stdout.trim();
}

/**
 * Reset a git repository to a specific commit.
 */
export function resetToCommit(repoDir: string, commit: string): void {
  const result = spawnSync('git', ['reset', '--hard', commit], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`Failed to reset to commit ${commit}: ${result.stderr}`);
  }

  // Update submodules
  spawnSync('git', ['submodule', 'update', '--init', '--recursive', '--force'], {
    cwd: repoDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Check if the project is up to date with the template.
 */
export function isProjectUpdated(
  repoDir: string,
  currentCommit: string,
  latestCommit: string,
  strict: boolean = true,
): boolean {
  if (latestCommit === currentCommit) {
    return true;
  }

  // Check if there are any changes between the commits
  try {
    const result = spawnSync('git', ['diff', '--quiet', currentCommit, latestCommit], {
      cwd: repoDir,
      stdio: 'pipe',
    });
    if (result.status === 0) {
      return true; // No differences
    }
  } catch {
    // Execution error
  }

  // In non-strict mode, check if current commit is a descendant of latest
  if (!strict) {
    try {
      const result = spawnSync(
        'git',
        ['merge-base', '--is-ancestor', latestCommit, currentCommit],
        { cwd: repoDir, stdio: 'pipe' },
      );
      if (result.status === 0) return true;
    } catch {
      // Not an ancestor
    }
  }

  return false;
}

// ==========================================
// Diff Operations
// ==========================================

/**
 * Build the git diff command with appropriate options.
 */
function buildGitDiffCommand(...args: string[]): string[] {
  return [
    'git',
    '-c',
    'diff.noprefix=',
    'diff',
    '--no-index',
    '--relative',
    '--binary',
    `--src-prefix=${DIFF_SRC_PREFIX}/`,
    `--dst-prefix=${DIFF_DST_PREFIX}/`,
    ...args,
  ];
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute the raw diff between two directories.
 */
export function getDiff(oldDir: string, newDir: string): string {
  const oldDirResolved = path.resolve(oldDir).replace(/\\/g, '/');
  const newDirResolved = path.resolve(newDir).replace(/\\/g, '/');

  const command = buildGitDiffCommand(
    '--no-ext-diff',
    '--no-color',
    oldDirResolved,
    newDirResolved,
  );

  try {
    const result = spawnSync(command[0], command.slice(1), {
      cwd: oldDirResolved,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });

    let diff = result.stdout || '';

    // Clean up the paths in the diff output
    for (const repo of [oldDirResolved, newDirResolved]) {
      const normalizedRepo = repo.replace(/^\/[a-z]:/i, '');
      diff = diff
        .replace(new RegExp(`${DIFF_SRC_PREFIX}${escapeRegExp(normalizedRepo)}`, 'g'), DIFF_SRC_PREFIX)
        .replace(new RegExp(`${DIFF_DST_PREFIX}${escapeRegExp(normalizedRepo)}`, 'g'), DIFF_DST_PREFIX)
        .replace(new RegExp(`${DIFF_SRC_PREFIX}${escapeRegExp(repo)}`, 'g'), DIFF_SRC_PREFIX)
        .replace(new RegExp(`${DIFF_DST_PREFIX}${escapeRegExp(repo)}`, 'g'), DIFF_DST_PREFIX);
    }

    diff = diff
      .replace(new RegExp(escapeRegExp(`${oldDirResolved}/`), 'g'), '')
      .replace(new RegExp(escapeRegExp(`${newDirResolved}/`), 'g'), '');

    return diff;
  } catch (err: any) {
    if (err.message?.includes('UnicodeDecodeError') || err.message?.includes('encoding')) {
      throw new ChangesetUnicodeError();
    }
    throw err;
  }
}

/**
 * Display the diff between two directories using git's pager.
 */
export function displayDiff(oldDir: string, newDir: string): void {
  const oldDirResolved = path.resolve(oldDir).replace(/\\/g, '/');
  const newDirResolved = path.resolve(newDir).replace(/\\/g, '/');

  const command = buildGitDiffCommand(oldDirResolved, newDirResolved);

  spawnSync(command[0], command.slice(1), {
    stdio: 'inherit',
  });
}

// ==========================================
// Patch Operations
// ==========================================

export interface PatchResult {
  success: boolean;
  message: string;
}

/**
 * Apply a diff patch using git's three-way merge.
 */
export function applyThreeWayPatch(
  diff: string,
  targetDir: string,
): PatchResult {
  const offset = getGitOffset(targetDir);

  const gitApply = ['apply', '-3'];
  if (offset) {
    gitApply.push('--directory', offset);
  }

  try {
    const result = spawnSync('git', gitApply, {
      cwd: targetDir,
      input: diff,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status === 0) {
      return { success: true, message: '' };
    }

    return {
      success: false,
      message: result.stderr || 'Failed to apply patch',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to apply patch',
    };
  }
}

/**
 * Apply a diff patch with rejection files for conflicts.
 */
export function applyPatchWithRejections(diff: string, targetDir: string): PatchResult {
  const offset = getGitOffset(targetDir);

  const gitApply = ['apply', '--reject'];
  if (offset) {
    gitApply.push('--directory', offset);
  }

  try {
    const result = spawnSync('git', gitApply, {
      cwd: targetDir,
      input: diff,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status === 0) {
      return { success: true, message: '' };
    }

    const message = result.stderr
      || 'Project directory may have *.rej files reflecting merge conflicts. '
        + 'Please resolve those conflicts manually.';

    return { success: true, message };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to apply patch',
    };
  }
}

/**
 * Apply a diff patch to a directory.
 * Uses three-way merge for git repos, falls back to reject files for conflicts.
 */
export function applyPatch(
  diff: string,
  targetDir: string,
  allowUntrackedFiles: boolean = false,
): PatchResult {
  if (isGitRepo(targetDir)) {
    const result = applyThreeWayPatch(diff, targetDir);

    if (!result.success && isRepoClean(targetDir, allowUntrackedFiles)) {
      console.warn('Failed to apply the update. Retrying with a different update strategy.');
      return applyPatchWithRejections(diff, targetDir);
    }

    return result;
  }

  return applyPatchWithRejections(diff, targetDir);
}

// ==========================================
// Temp Directory Helper
// ==========================================

/**
 * Create a temporary directory.
 */
export function createTempDir(prefix: string = 'biscuitcutter-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
