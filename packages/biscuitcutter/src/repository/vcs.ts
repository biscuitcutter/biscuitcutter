/**
 * Helper functions for working with version control systems.
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { getLogger } from '../utils/log';
import {
  RepositoryCloneFailedError,
  RepositoryNotFoundError,
  UnknownRepoTypeError,
  VCSNotInstalledError,
} from '../utils/exceptions';
import { promptAndDelete } from '../core/prompt';
import { makeSurePathExists } from '../utils/utils';

const logger = getLogger('biscuitcutter.vcs');

const BRANCH_ERRORS = ['error: pathspec', 'unknown revision'];

type RepoType = 'git' | 'hg';

/**
 * Determine if `repoUrl` should be treated as a URL to a git or hg repo.
 *
 * Repos can be identified by prepending "hg+" or "git+" to the repo URL.
 */
export function identifyRepo(repoUrl: string): [RepoType, string] {
  const parts = repoUrl.split('+');
  if (parts.length === 2) {
    const repoType = parts[0];
    if (repoType === 'git' || repoType === 'hg') {
      return [repoType, parts[1]];
    }
    throw new UnknownRepoTypeError(
      `Unknown repo type: ${repoType}`,
    );
  }
  if (repoUrl.includes('git')) {
    return ['git', repoUrl];
  }
  if (repoUrl.includes('bitbucket')) {
    return ['hg', repoUrl];
  }
  throw new UnknownRepoTypeError(
    `Unable to determine repo type for: ${repoUrl}`,
  );
}

/**
 * Check if the version control system for a repo type is installed.
 */
export function isVcsInstalled(repoType: string): boolean {
  try {
    execSync(`which ${repoType}`, { stdio: 'ignore' });
    return true;
  } catch {
    // On Windows, try 'where' instead of 'which'
    if (process.platform === 'win32') {
      try {
        execSync(`where ${repoType}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Clone a repo to the specified directory.
 *
 * @param repoUrl - Repo URL of unknown type.
 * @param checkout - The branch, tag or commit ID to checkout after clone.
 * @param cloneToDir - The directory to clone to. Defaults to ".".
 * @param noInput - Do not prompt for user input.
 * @returns Path to the new directory of the repository.
 */
export async function clone(
  repoUrl: string,
  checkout?: string | null,
  cloneToDir: string = '.',
  noInput: boolean = false,
): Promise<string> {
  // Ensure that cloneToDir exists
  const expandedCloneDir = path.resolve(cloneToDir);
  makeSurePathExists(expandedCloneDir);

  // Identify the repo type
  const [repoType, cleanUrl] = identifyRepo(repoUrl);

  // Check that the appropriate VCS is installed
  if (!isVcsInstalled(repoType)) {
    throw new VCSNotInstalledError(`'${repoType}' is not installed.`);
  }

  const trimmedUrl = cleanUrl.replace(/\/+$/, '');
  let repoName = path.basename(trimmedUrl);
  let repoDir: string;

  if (repoType === 'git') {
    repoName = repoName.split(':').pop()!.replace(/\.git$/, '');
    repoDir = path.normalize(path.join(expandedCloneDir, repoName));
  } else {
    repoDir = path.normalize(path.join(expandedCloneDir, repoName));
  }

  logger.debug('repo_dir is %s', repoDir);

  let shouldClone: boolean;
  if (fs.existsSync(repoDir) && fs.statSync(repoDir).isDirectory()) {
    shouldClone = await promptAndDelete(repoDir, noInput);
  } else {
    shouldClone = true;
  }

  if (shouldClone) {
    try {
      execSync(`${repoType} clone ${cleanUrl}`, {
        cwd: expandedCloneDir,
        stdio: 'pipe',
      });

      if (checkout) {
        const checkoutParams = repoType === 'hg' ? ['--', checkout] : [checkout];
        execSync(`${repoType} checkout ${checkoutParams.join(' ')}`, {
          cwd: repoDir,
          stdio: 'pipe',
        });
      }
    } catch (err: any) {
      const output = err.stderr?.toString('utf-8') || err.stdout?.toString('utf-8') || '';

      if (output.toLowerCase().includes('not found')) {
        throw new RepositoryNotFoundError(
          `The repository ${cleanUrl} could not be found, have you made a typo?`,
        );
      }
      if (BRANCH_ERRORS.some((e) => output.includes(e))) {
        throw new RepositoryCloneFailedError(
          `The ${checkout} branch of repository ${cleanUrl} could not found, have you made a typo?`,
        );
      }
      logger.error('git clone failed with error: %s', output);
      throw err;
    }
  }

  return repoDir;
}
