/**
 * Functions for finding BiscuitCutter templates and other components.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../utils/log';
import { NonTemplatedInputDirError } from '../utils/exceptions';
import { VARIABLE_START_STRING, VARIABLE_END_STRING } from '../templating';

const logger = getLogger('biscuitcutter.find');

/**
 * Determine which child directory of `repoDir` is the project template.
 *
 * @param repoDir - Local directory of newly cloned repo.
 * @returns Absolute path to project template.
 */
export function findTemplate(repoDir: string): string {
  logger.debug('Searching %s for the project template.', repoDir);

  const entries = fs.readdirSync(repoDir);

  for (const entry of entries) {
    if (
      (entry.includes('cookiecutter') || entry.includes('biscuitcutter'))
      && entry.includes(VARIABLE_START_STRING)
      && entry.includes(VARIABLE_END_STRING)
    ) {
      const projectTemplate = path.join(repoDir, entry);
      logger.debug('The project template appears to be %s', projectTemplate);
      return projectTemplate;
    }
  }

  throw new NonTemplatedInputDirError(
    `The repository directory '${repoDir}' does not contain a templated project directory.`,
  );
}
