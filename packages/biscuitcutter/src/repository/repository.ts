/**
 * BiscuitCutter repository functions.
 */

import * as path from 'path';
import * as fs from 'fs';
import { RepositoryNotFoundError } from '../utils/exceptions';
import { clone } from './vcs';
import { unzip } from './zipfile';

const REPO_REGEX = new RegExp(
  // something like git:// ssh:// file:// etc.
  '((((git|hg)\\+)?(git|ssh|file|https?):(//)?)'
    + '|'
    // something like user@...
    + '(\\w+@[\\w.]+))',
);

/**
 * Return true if value is a repository URL.
 */
export function isRepoUrl(value: string): boolean {
  return REPO_REGEX.test(value);
}

/**
 * Return true if value is a zip file.
 */
export function isZipFile(value: string): boolean {
  return value.toLowerCase().endsWith('.zip');
}

/**
 * Expand abbreviations in a template name.
 */
export function expandAbbreviations(
  template: string,
  abbreviations: Record<string, string>,
): string {
  if (template in abbreviations) {
    return abbreviations[template];
  }

  // Split on colon
  const colonIndex = template.indexOf(':');
  if (colonIndex !== -1) {
    const prefix = template.substring(0, colonIndex);
    const rest = template.substring(colonIndex + 1);
    if (prefix in abbreviations) {
      return abbreviations[prefix].replace('{0}', rest);
    }
  }

  return template;
}

/**
 * Determine if `repoDirectory` contains a supported template config file.
 * Checks for copier.yml/copier.yaml, biscuitcutter.json, or cookiecutter.json.
 */
export function repositoryHasTemplateConfig(repoDirectory: string): boolean {
  const dirExists = fs.existsSync(repoDirectory) && fs.statSync(repoDirectory).isDirectory();
  if (!dirExists) return false;

  return fs.existsSync(path.join(repoDirectory, 'copier.yml'))
    || fs.existsSync(path.join(repoDirectory, 'copier.yaml'))
    || fs.existsSync(path.join(repoDirectory, 'biscuitcutter.json'))
    || fs.existsSync(path.join(repoDirectory, 'cookiecutter.json'));
}

/**
 * @deprecated Use repositoryHasTemplateConfig instead.
 */
export function repositoryHasCookiecutterJson(repoDirectory: string): boolean {
  return repositoryHasTemplateConfig(repoDirectory);
}

/**
 * Locate the repository directory from a template reference.
 *
 * Applies repository abbreviations to the template reference.
 * If the template refers to a repository URL, clone it.
 * If the template is a path to a local repository, use it.
 *
 * @returns A tuple of [repoDir, cleanup] where cleanup indicates whether the
 *          directory should be cleaned up after the template has been instantiated.
 */
export async function determineRepoDir(
  template: string,
  abbreviations: Record<string, string>,
  cloneToDir: string,
  checkout?: string | null,
  noInput: boolean = false,
  password?: string | null,
  directory?: string | null,
): Promise<[string, boolean]> {
  const expandedTemplate = expandAbbreviations(template, abbreviations);

  let repositoryCandidates: string[];
  let cleanup: boolean;

  if (isZipFile(expandedTemplate)) {
    const unzippedDir = await unzip(
      expandedTemplate,
      isRepoUrl(expandedTemplate),
      cloneToDir,
      noInput,
      password,
    );
    repositoryCandidates = [unzippedDir];
    cleanup = true;
  } else if (isRepoUrl(expandedTemplate)) {
    const clonedRepo = await clone(
      expandedTemplate,
      checkout,
      cloneToDir,
      noInput,
    );
    repositoryCandidates = [clonedRepo];
    cleanup = false;
  } else {
    repositoryCandidates = [expandedTemplate, path.join(cloneToDir, expandedTemplate)];
    cleanup = false;
  }

  if (directory) {
    repositoryCandidates = repositoryCandidates.map((s) => path.join(s, directory));
  }

  for (const repoCandidate of repositoryCandidates) {
    if (repositoryHasTemplateConfig(repoCandidate)) {
      return [repoCandidate, cleanup];
    }
  }

  throw new RepositoryNotFoundError(
    `A valid repository for "${expandedTemplate}" could not be found in the following `
      + `locations:\n${repositoryCandidates.join('\n')}\n`
      + 'Expected one of: copier.yml, copier.yaml, biscuitcutter.json, or cookiecutter.json',
  );
}
