/**
 * Utility functions for handling and fetching repo archives in zip format.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { InvalidZipRepositoryError } from '../utils/exceptions';
import { promptAndDelete } from '../core/prompt';
import { makeSurePathExists } from '../utils/utils';

/**
 * Download a file from a URL.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const https = require('https');
  const http = require('http');

  return new Promise<void>((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response: any) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err: Error) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Unzip a local zip file to a temporary directory.
 */
function unzipLocal(zipPath: string, password?: string | null): string {
  const unzipBase = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-unzip-'));

  try {
    // Use the system's unzip command
    let cmd: string;
    if (password) {
      cmd = `unzip -P "${password}" -o "${zipPath}" -d "${unzipBase}"`;
    } else {
      cmd = `unzip -o "${zipPath}" -d "${unzipBase}"`;
    }

    try {
      execSync(cmd, { stdio: 'pipe' });
    } catch (err: any) {
      const output = err.stderr?.toString('utf-8') || '';
      if (output.includes('incorrect password') || output.includes('wrong password')) {
        throw new InvalidZipRepositoryError(
          'Invalid password provided for protected repository',
        );
      }
      if (output.includes('End-of-central-directory') || output.includes('is not a zip')) {
        throw new InvalidZipRepositoryError(
          `Zip repository ${zipPath} is not a valid zip archive`,
        );
      }
      throw new InvalidZipRepositoryError(
        `Failed to unzip ${zipPath}: ${output}`,
      );
    }

    // Find the extracted directory
    const entries = fs.readdirSync(unzipBase);
    if (entries.length === 0) {
      throw new InvalidZipRepositoryError(
        `Zip repository ${zipPath} is empty`,
      );
    }

    const firstEntry = entries[0];
    const unzipPath = path.join(unzipBase, firstEntry);

    if (!fs.statSync(unzipPath).isDirectory()) {
      throw new InvalidZipRepositoryError(
        `Zip repository ${zipPath} does not include a top-level directory`,
      );
    }

    return unzipPath;
  } catch (err) {
    if (err instanceof InvalidZipRepositoryError) {
      throw err;
    }
    throw new InvalidZipRepositoryError(
      `Failed to process zip file ${zipPath}: ${err}`,
    );
  }
}

/**
 * Download and unpack a zipfile at a given URI.
 *
 * This will download the zipfile to the biscuitcutter repository,
 * and unpack into a temporary directory.
 */
export async function unzip(
  zipUri: string,
  isUrl: boolean,
  cloneToDir: string = '.',
  noInput: boolean = false,
  password?: string | null,
): Promise<string> {
  // Ensure that cloneToDir exists
  const expandedCloneDir = path.resolve(cloneToDir);
  makeSurePathExists(expandedCloneDir);

  let zipPath: string;

  if (isUrl) {
    // Build the name of the cached zipfile
    const identifier = zipUri.split('/').pop()!;
    zipPath = path.join(expandedCloneDir, identifier);

    if (fs.existsSync(zipPath)) {
      const download = await promptAndDelete(zipPath, noInput);
      if (!download) {
        // Reuse existing
        return unzipLocal(zipPath, password);
      }
    }

    // Download the zipfile
    await downloadFile(zipUri, zipPath);
  } else {
    zipPath = path.resolve(zipUri);
  }

  return unzipLocal(zipPath, password);
}
