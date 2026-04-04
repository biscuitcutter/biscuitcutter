import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import os from 'os';
import { biscuitcutter } from '../../src/core/main';
import { rmtree } from '../../src/utils/utils';

describe('Cookiecutter Backward Compatibility', () => {
  const fixtureDir = path.join(__dirname, '_fixtures', 'cookiecutter-template');
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-compat-'));
  });

  afterEach(() => {
    rmtree(outputDir);
  });

  it('should successfully generate a template mapped from cookiecutter.json and using cookiecutter jinja tags', async () => {
    await biscuitcutter({
      template: fixtureDir,
      outputDir,
      noInput: true,
    });

    const expectedProjectDir = path.join(outputDir, 'Legacy Project');
    expect(fs.existsSync(expectedProjectDir)).toBe(true);

    const readmePath = path.join(expectedProjectDir, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    expect(readmeContent).toContain('# Legacy Project');
    expect(readmeContent).toContain('By Legacy Author');
    expect(readmeContent).toContain('Slug: legacy_project');
  });
});
