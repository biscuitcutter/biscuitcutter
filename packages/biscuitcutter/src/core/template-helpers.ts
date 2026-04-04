import * as fs from 'fs';
import * as path from 'path';
import { PathTraversalError } from '../utils/exceptions';

/**
 * Filter out private variables (starting with _) from a context object.
 */
export function filterPublicContext(context: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(context).filter(([key]) => !key.startsWith('_')),
  );
}

/**
 * Find the context file in a template directory.
 * Checks for biscuitcutter.json first, then falls back to cookiecutter.json.
 */
export function findContextFile(dir: string): string {
  const biscuitcutterJson = path.join(dir, 'biscuitcutter.json');
  if (fs.existsSync(biscuitcutterJson)) {
    return biscuitcutterJson;
  }
  return path.join(dir, 'cookiecutter.json');
}

/**
 * Resolve the template directory within a repo, optionally descending into a subdirectory.
 * Validates that the resolved path stays within repoDir to prevent path traversal.
 */
export function resolveTemplateDir(repoDir: string, directory: string | null | undefined): string {
  if (!directory) {
    return repoDir;
  }
  const resolved = path.resolve(repoDir, directory);
  const resolvedRepo = path.resolve(repoDir);
  if (!resolved.startsWith(resolvedRepo + path.sep) && resolved !== resolvedRepo) {
    throw new PathTraversalError(directory, repoDir);
  }
  return resolved;
}
