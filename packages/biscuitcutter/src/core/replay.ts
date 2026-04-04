/**
 * BiscuitCutter replay functions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { makeSurePathExists } from '../utils/utils';

/**
 * Get the name of the replay file.
 */
export function getFileName(replayDir: string, templateName: string): string {
  const suffix = templateName.endsWith('.json') ? '' : '.json';
  const fileName = `${templateName}${suffix}`;
  return path.join(replayDir, fileName);
}

/**
 * Write JSON data to a replay file.
 */
export function dump(
  replayDir: string,
  templateName: string,
  context: Record<string, any>,
): void {
  makeSurePathExists(replayDir);

  if (!('biscuitcutter' in context)) {
    throw new Error('Context is required to contain a biscuitcutter key');
  }

  const replayFile = getFileName(replayDir, templateName);
  fs.writeFileSync(replayFile, JSON.stringify(context, null, 2), 'utf-8');
}

/**
 * Read JSON data from a replay file.
 */
export function load(
  replayDir: string,
  templateName: string,
): Record<string, any> {
  const replayFile = getFileName(replayDir, templateName);
  const content = fs.readFileSync(replayFile, 'utf-8');
  const context = JSON.parse(content);

  if (!('biscuitcutter' in context)) {
    throw new Error('Context is required to contain a biscuitcutter key');
  }

  return context;
}
