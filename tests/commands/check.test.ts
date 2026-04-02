/**
 * Tests for the `check` command.
 *
 * Tests the check() function which verifies whether a project is
 * up-to-date with its linked template.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
  check, writeTemplateState, TemplateState,
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
    getLatestCommit: vi.fn().mockReturnValue('latest-commit-hash'),
    isProjectUpdated: vi.fn().mockReturnValue(true),
    createTempDir: vi.fn((prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))),
  };
});

describe('check command', () => {
  let projectDir: string;

  function writeState(overrides: Partial<TemplateState> = {}): void {
    const state: TemplateState = {
      template: FIXTURE_DIR,
      commit: 'old-commit-hash',
      checkout: null,
      context: { project_name: 'My Test Project' },
      directory: null,
      ...overrides,
    };
    writeTemplateState(projectDir, state);
  }

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-check-test-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should report up-to-date when project matches latest commit', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(true);

    const result = await check({ projectDir });

    expect(result.upToDate).toBe(true);
    expect(result.message).toContain('up to date');
  });

  it('should report out-of-date when project does not match latest commit', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);

    const result = await check({ projectDir });

    expect(result.upToDate).toBe(false);
    expect(result.message).toContain('out of date');
  });

  it('should return current and latest commit hashes', async () => {
    writeState({ commit: 'my-current-commit' });
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);

    const result = await check({ projectDir });

    expect(result.currentCommit).toBe('my-current-commit');
    expect(result.latestCommit).toBe('latest-commit-hash');
  });

  it('should throw TemplateStateNotFoundError when no state file exists', async () => {
    await expect(check({ projectDir })).rejects.toThrow(TemplateStateNotFoundError);
  });

  it('should use checkout from state file when no checkout option provided', async () => {
    writeState({ checkout: 'main' });

    await check({ projectDir });

    expect(gitUtils.cloneRepo).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'main',
      true,
    );
  });

  it('should prefer explicit checkout option over state checkout', async () => {
    writeState({ checkout: 'main' });

    await check({ projectDir, checkout: 'develop' });

    expect(gitUtils.cloneRepo).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'develop',
      true,
    );
  });

  it.each([
    [false, false],
    [undefined, true],
  ])('should pass strict=%s (expected %s) to isProjectUpdated', async (strict, expected) => {
    writeState();

    await check({ projectDir, strict: strict as boolean | undefined });

    expect(gitUtils.isProjectUpdated).toHaveBeenCalledWith(
      expect.any(String),
      'old-commit-hash',
      'latest-commit-hash',
      expected,
    );
  });
});
