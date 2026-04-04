/**
 * Tests for the `create` command.
 *
 * Tests the create() function which generates a project from a template
 * with update tracking enabled (.biscuitcutter.json state file).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { create, readTemplateState, STATE_FILE } from '../../src/core/tracking';

const FIXTURE_DIR = path.join(__dirname, '..', '_fixtures', 'fake-repo-simple');

/**
 * Mock git utilities to avoid real git operations.
 * cloneRepo copies the fixture template to the target directory.
 */
vi.mock('../../src/utils/git', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/git')>();
  return {
    ...actual,
    cloneRepo: vi.fn((templateUrl: string, targetDir: string) => {
      const fsExtra = require('fs-extra');
      fsExtra.copySync(templateUrl, targetDir);
      return targetDir;
    }),
    getLatestCommit: vi.fn().mockReturnValue('abc123def456'),
    isGitRepo: vi.fn().mockReturnValue(true),
    isRepoClean: vi.fn().mockReturnValue(true),
    createTempDir: vi.fn((prefix: string) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))),
  };
});

describe('create command', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-create-test-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should create a project and write a .biscuitcutter.json state file', async () => {
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, STATE_FILE))).toBe(true);

    const state = readTemplateState(projectDir);
    expect(state.template).toBe(FIXTURE_DIR);
    expect(state.commit).toBe('abc123def456');
    expect(state.context).toBeDefined();
    expect(state.context.project_name).toBe('My Test Project');
  });

  it('should generate template files with rendered content', async () => {
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    const readmePath = path.join(projectDir, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    expect(readmeContent).toContain('# My Test Project');
    expect(readmeContent).toContain('Version: 0.1.0');
  });

  it('should apply extra context overrides', async () => {
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
      extraContext: { project_name: 'Custom Name', project_slug: 'custom-name' },
    });

    const state = readTemplateState(projectDir);
    expect(state.context.project_name).toBe('Custom Name');
    expect(state.context.project_slug).toBe('custom-name');

    // The generated project directory should contain the rendered slug
    expect(path.basename(projectDir)).toBe('custom-name');
  });

  it('should store checkout in state', async () => {
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
      checkout: 'v1.0',
    });

    const state = readTemplateState(projectDir);
    expect(state.checkout).toBe('v1.0');
  });

  it('should store directory in state when specified', async () => {
    // Creating with directory=null (default)
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
      directory: null,
    });

    const state = readTemplateState(projectDir);
    expect(state.directory).toBeNull();
  });

  it('should store skip paths in state when provided', async () => {
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
      skip: ['README.md', '*.lock'],
    });

    const state = readTemplateState(projectDir);
    expect(state.skip).toEqual(['README.md', '*.lock']);
  });

  it('should not include skip in state when not provided', async () => {
    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    const state = readTemplateState(projectDir);
    expect(state.skip).toBeUndefined();
  });

  it('should load extra context from file when extraContextFile is provided', async () => {
    const contextFile = path.join(outputDir, 'extra-context.json');
    fs.writeFileSync(
      contextFile,
      JSON.stringify({ project_name: 'From File', version: '2.0.0' }),
    );

    const projectDir = await create({
      templateGitUrl: FIXTURE_DIR,
      outputDir,
      noInput: true,
      extraContextFile: contextFile,
    });

    const state = readTemplateState(projectDir);
    expect(state.context.project_name).toBe('From File');
    expect(state.context.version).toBe('2.0.0');
  });
});
