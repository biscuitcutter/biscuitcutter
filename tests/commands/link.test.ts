/**
 * Tests for the `link` command.
 *
 * Tests the link() function which retrofits update tracking onto
 * an existing project by creating a .biscuitcutter.json state file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import {
  link, readTemplateState, STATE_FILE,
} from '../../src/core/tracking';
import { TemplateStateExistsError } from '../../src/utils/exceptions';

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
    getLatestCommit: vi.fn().mockReturnValue('link-commit-hash'),
    isGitRepo: vi.fn().mockReturnValue(true),
    createTempDir: vi.fn((prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))),
  };
});

describe('link command', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-link-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('should create a .biscuitcutter.json state file', async () => {
    const result = await link({
      templateGitUrl: FIXTURE_DIR,
      projectDir,
      noInput: true,
    });

    expect(result).toBe(true);
    expect(fs.existsSync(path.join(projectDir, STATE_FILE))).toBe(true);
  });

  it('should store template URL and commit in state', async () => {
    await link({
      templateGitUrl: FIXTURE_DIR,
      projectDir,
      noInput: true,
    });

    const state = readTemplateState(projectDir);
    expect(state.template).toBe(FIXTURE_DIR);
    expect(state.commit).toBe('link-commit-hash');
  });

  it('should store context variables from template', async () => {
    await link({
      templateGitUrl: FIXTURE_DIR,
      projectDir,
      noInput: true,
    });

    const state = readTemplateState(projectDir);
    expect(state.context.project_name).toBe('My Test Project');
    expect(state.context.version).toBe('0.1.0');
  });

  it('should store checkout in state', async () => {
    await link({
      templateGitUrl: FIXTURE_DIR,
      projectDir,
      noInput: true,
      checkout: 'v2.0',
    });

    const state = readTemplateState(projectDir);
    expect(state.checkout).toBe('v2.0');
  });

  it('should store directory in state', async () => {
    await link({
      templateGitUrl: FIXTURE_DIR,
      projectDir,
      noInput: true,
      directory: null,
    });

    const state = readTemplateState(projectDir);
    expect(state.directory).toBeNull();
  });

  it('should throw TemplateStateExistsError if state file already exists', async () => {
    // Write an existing state file
    fs.writeFileSync(path.join(projectDir, STATE_FILE), '{}');

    await expect(
      link({
        templateGitUrl: FIXTURE_DIR,
        projectDir,
        noInput: true,
      }),
    ).rejects.toThrow(TemplateStateExistsError);
  });

  it('should apply extra context overrides', async () => {
    await link({
      templateGitUrl: FIXTURE_DIR,
      projectDir,
      noInput: true,
      extraContext: { project_name: 'Linked Project' },
    });

    const state = readTemplateState(projectDir);
    expect(state.context.project_name).toBe('Linked Project');
  });
});
