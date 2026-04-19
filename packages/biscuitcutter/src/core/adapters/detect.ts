/**
 * Template type detection and adapter factory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../../utils/log';
import { TemplateType, TemplateAdapter } from './types';
import { CookiecutterAdapter } from './cookiecutter-adapter';
import { CopierAdapter } from './copier-adapter';

const logger = getLogger('biscuitcutter.adapters.detect');

/**
 * Detect the template type based on the config files present in a repository directory.
 *
 * Detection priority:
 * 1. copier.yml / copier.yaml → Copier
 * 2. biscuitcutter.json → BiscuitCutter
 * 3. cookiecutter.json → Cookiecutter
 */
export function detectTemplateType(repoDir: string): TemplateType {
  if (
    fs.existsSync(path.join(repoDir, 'copier.yml'))
    || fs.existsSync(path.join(repoDir, 'copier.yaml'))
  ) {
    logger.debug('Detected Copier template in %s', repoDir);
    return 'copier';
  }

  if (fs.existsSync(path.join(repoDir, 'biscuitcutter.json'))) {
    logger.debug('Detected BiscuitCutter template in %s', repoDir);
    return 'biscuitcutter';
  }

  if (fs.existsSync(path.join(repoDir, 'cookiecutter.json'))) {
    logger.debug('Detected Cookiecutter template in %s', repoDir);
    return 'cookiecutter';
  }

  // Default to cookiecutter for backward compatibility
  logger.debug('No template config found in %s, defaulting to cookiecutter', repoDir);
  return 'cookiecutter';
}

/**
 * Create the appropriate template adapter for the given type.
 */
export function createAdapter(type: TemplateType): TemplateAdapter {
  switch (type) {
    case 'copier':
      return new CopierAdapter();
    case 'biscuitcutter':
    case 'cookiecutter':
      return new CookiecutterAdapter(type);
    default:
      return new CookiecutterAdapter('cookiecutter');
  }
}

/**
 * Detect template type and create the appropriate adapter.
 */
export function createAdapterForRepo(repoDir: string): TemplateAdapter {
  const type = detectTemplateType(repoDir);
  return createAdapter(type);
}

/**
 * Re-export the canonical repository template-config check to avoid
 * duplicated implementations drifting over time.
 */
export { repositoryHasTemplateConfig } from '../../repository/repository';
