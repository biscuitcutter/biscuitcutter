/**
 * Tests for the `diff` command.
 *
 * Tests the diff() function which shows the differences between
 * a project and its linked template.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
  diff, writeTemplateState, TemplateState,
} from '../../src/core/tracking';
import * as gitUtils from '../../src/utils/git';
import { TemplateStateNotFoundError } from '../../src/utils/exceptions';

const FIXTURE_DIR = path.join(__dirname, '..', '_fixtures', 'fake-repo-simple');

vi.mock('../../src/utils/git', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/git')>();
  return {
    ...actual,
    cloneRepo: vi.fn((templateUrl: string, targetDir: string) => {
      const fsExtra = require('fs-extra');
      fsExtra.copySync(templateUrl, targetDir);
      return targetDir;
    }),
    getLatestCommit: vi.fn().mockReturnValue('current-commit-hash'),
    getDiff: vi.fn().mockReturnValue(''),
    displayDiff: vi.fn(),
    resetToCommit: vi.fn(),
    createTempDir: vi.fn((prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))),
  };
});

describe('diff command', () => {
  let projectDir: string;

  function writeState(overrides: Partial<TemplateState> = {}): void {
    const state: TemplateState = {
      template: FIXTURE_DIR,
      commit: 'current-commit-hash',
      checkout: null,
      context: {
        project_name: 'My Test Project',
        project_slug: 'my-test-project',
        version: '0.1.0',
      },
      directory: null,
      ...overrides,
    };
    writeTemplateState(projectDir, state);
  }

  function createProjectFiles(): void {
    const slugDir = path.join(projectDir, 'my-test-project');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'README.md'), '# My Test Project\n\nVersion: 0.1.0\n');
    fs.writeFileSync(
      path.join(slugDir, 'package.json'),
      JSON.stringify({ name: 'my-test-project', version: '0.1.0' }, null, 2),
    );
  }

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-diff-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('should throw TemplateStateNotFoundError when no state file', async () => {
    await expect(diff({ projectDir })).rejects.toThrow(TemplateStateNotFoundError);
  });

  it('should report no diff when project matches template', async () => {
    writeState();
    createProjectFiles();
    vi.mocked(gitUtils.getDiff).mockReturnValue('');

    const result = await diff({ projectDir });

    expect(result.hasDiff).toBe(false);
    expect(result.diff).toBe('');
    expect(result.exitCode).toBe(0);
  });

  it('should report diff when project differs from template', async () => {
    writeState();
    createProjectFiles();
    vi.mocked(gitUtils.getDiff).mockReturnValue('--- a/README.md\n+++ b/README.md\n-old\n+new');

    const result = await diff({ projectDir });

    expect(result.hasDiff).toBe(true);
    expect(result.diff).toContain('README.md');
  });

  it.each([
    [true, 'some diff', 1],
    [true, '', 0],
    [false, 'some diff', 0],
  ])('should return correct exit code (exitCode=%s, diff="%s", expected=%d)', async (exitCodeOpt, diffOutput, expected) => {
    writeState();
    createProjectFiles();
    vi.mocked(gitUtils.getDiff).mockReturnValue(diffOutput);

    const result = await diff({ projectDir, exitCode: exitCodeOpt });

    expect(result.exitCode).toBe(expected);
  });

  it('should use commit from state when no checkout is specified', async () => {
    writeState({ commit: 'specific-commit' });
    createProjectFiles();

    await diff({ projectDir });

    expect(gitUtils.cloneRepo).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'specific-commit',
    );
  });

  it('should prefer explicit checkout over state commit', async () => {
    writeState({ commit: 'state-commit' });
    createProjectFiles();

    await diff({ projectDir, checkout: 'my-branch' });

    expect(gitUtils.cloneRepo).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'my-branch',
    );
  });
});
