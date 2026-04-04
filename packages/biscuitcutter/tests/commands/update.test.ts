/**
 * Tests for the `update` command.
 *
 * Tests the update() function which updates a project to match a newer
 * version of its template.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
  update,
  writeTemplateState,
  readTemplateState,
  TemplateState,
  STATE_FILE,
} from '../../src/core/tracking';
import * as gitUtils from '../../src/utils/git';
import { DirtyGitRepositoryError, TemplateStateNotFoundError } from '../../src/utils/exceptions';

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
    getLatestCommit: vi.fn().mockReturnValue('new-commit-hash'),
    isProjectUpdated: vi.fn().mockReturnValue(false),
    isRepoClean: vi.fn().mockReturnValue(true),
    isGitRepo: vi.fn().mockReturnValue(true),
    getDiff: vi.fn().mockReturnValue(''),
    displayDiff: vi.fn(),
    applyPatch: vi.fn().mockReturnValue({ success: true, message: '' }),
    resetToCommit: vi.fn(),
    createTempDir: vi.fn((prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))),
  };
});

describe('update command', () => {
  let projectDir: string;

  function writeState(overrides: Partial<TemplateState> = {}): void {
    const state: TemplateState = {
      template: FIXTURE_DIR,
      commit: 'old-commit-hash',
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

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-update-test-'));
    vi.clearAllMocks();
    // Restore mock defaults after clearAllMocks wipes them
    vi.mocked(gitUtils.getLatestCommit).mockReturnValue('new-commit-hash');
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);
    vi.mocked(gitUtils.isRepoClean).mockReturnValue(true);
    vi.mocked(gitUtils.getDiff).mockReturnValue('');
    vi.mocked(gitUtils.applyPatch).mockReturnValue({ success: true, message: '' });
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('should throw TemplateStateNotFoundError when no state file exists', async () => {
    await expect(update({ projectDir })).rejects.toThrow(TemplateStateNotFoundError);
  });

  it('should throw DirtyGitRepositoryError when repo is not clean', async () => {
    writeState();
    vi.mocked(gitUtils.isRepoClean).mockReturnValue(false);

    await expect(update({ projectDir })).rejects.toThrow(DirtyGitRepositoryError);
  });

  it('should report already up-to-date when project matches latest commit', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(true);

    const result = await update({ projectDir, skipApplyAsk: true });

    expect(result.success).toBe(true);
    expect(result.alreadyUpToDate).toBe(true);
    expect(result.message).toContain('already up to date');
  });

  it('should update state file commit after successful update', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);

    await update({ projectDir, skipApplyAsk: true });

    const state = readTemplateState(projectDir);
    expect(state.commit).toBe('new-commit-hash');
  });

  it('should return success with diff when update succeeds', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);
    vi.mocked(gitUtils.getDiff).mockReturnValue('some diff output');

    const result = await update({ projectDir, skipApplyAsk: true });

    expect(result.success).toBe(true);
    expect(result.diff).toBeDefined();
  });

  it('should allow updates when allowUntrackedFiles is true', async () => {
    writeState();
    vi.mocked(gitUtils.isRepoClean).mockReturnValue(true);
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(true);

    const result = await update({ projectDir, allowUntrackedFiles: true, skipApplyAsk: true });
    expect(result.success).toBe(true);
  });

  it('should apply extra context during update', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);

    await update({
      projectDir,
      skipApplyAsk: true,
      extraContext: { version: '2.0.0' },
    });

    const state = readTemplateState(projectDir);
    expect(state.context.version).toBe('2.0.0');
  });

  it('should not skip update check when extra context is provided', async () => {
    writeState();
    // Even when project is up-to-date, extra context forces re-generation
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(true);

    const result = await update({
      projectDir,
      skipApplyAsk: true,
      extraContext: { version: '2.0.0' },
    });

    // Should still proceed with the update, not return alreadyUpToDate
    expect(result.alreadyUpToDate).toBeUndefined();
  });

  it('should skip applying patch when skipUpdate is true', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);
    vi.mocked(gitUtils.getDiff).mockReturnValue('some diff');

    await update({ projectDir, skipApplyAsk: true, skipUpdate: true });

    // applyPatch should NOT be called when skipUpdate is true
    expect(gitUtils.applyPatch).not.toHaveBeenCalled();
  });

  it('should override template path when templatePath is provided', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);

    await update({
      projectDir,
      templatePath: FIXTURE_DIR,
      skipApplyAsk: true,
    });

    const state = readTemplateState(projectDir);
    expect(state.template).toBe(FIXTURE_DIR);
  });

  it('should pass strict option through to isProjectUpdated', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(true);

    await update({ projectDir, strict: false, skipApplyAsk: true });

    expect(gitUtils.isProjectUpdated).toHaveBeenCalledWith(
      expect.any(String),
      'old-commit-hash',
      'new-commit-hash',
      false,
    );
  });

  it('should reject when extra-context-file points to state file', async () => {
    writeState();
    const stateFilePath = path.join(projectDir, STATE_FILE);

    const result = await update({
      projectDir,
      extraContextFile: stateFilePath,
      skipApplyAsk: true,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be the same');
  });

  it('should load extra context from file when extraContextFile is provided', async () => {
    writeState();
    vi.mocked(gitUtils.isProjectUpdated).mockReturnValue(false);

    const contextFile = path.join(projectDir, 'extra.json');
    fs.writeFileSync(contextFile, JSON.stringify({ version: '3.0.0' }));

    await update({
      projectDir,
      extraContextFile: contextFile,
      skipApplyAsk: true,
    });

    const state = readTemplateState(projectDir);
    expect(state.context.version).toBe('3.0.0');
  });
});
