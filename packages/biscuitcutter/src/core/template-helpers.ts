import * as fs from 'fs';
import * as path from 'path';

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
 */
export function resolveTemplateDir(repoDir: string, directory: string | null | undefined): string {
  return directory ? path.join(repoDir, directory) : repoDir;
}
