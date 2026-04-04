/**
 * Tests for git utilities used in template tracking.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import { getDiff, isGitRepo, isRepoClean } from '../../src/utils/git';

describe('Git Utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-git-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getDiff', () => {
    it('should return empty diff for identical directories', () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      fs.mkdirSync(dir1);
      fs.mkdirSync(dir2);

      fs.writeFileSync(path.join(dir1, 'file.txt'), 'hello world');
      fs.writeFileSync(path.join(dir2, 'file.txt'), 'hello world');

      const diff = getDiff(dir1, dir2);
      expect(diff.trim()).toBe('');
    });

    it('should return diff for modified files', () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      fs.mkdirSync(dir1);
      fs.mkdirSync(dir2);

      fs.writeFileSync(path.join(dir1, 'file.txt'), 'hello world');
      fs.writeFileSync(path.join(dir2, 'file.txt'), 'hello universe');

      const diff = getDiff(dir1, dir2);
      expect(diff).toContain('hello world');
      expect(diff).toContain('hello universe');
    });

    it('should return diff for new files', () => {
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      fs.mkdirSync(dir1);
      fs.mkdirSync(dir2);

      fs.writeFileSync(path.join(dir1, 'file.txt'), 'existing file');
      fs.writeFileSync(path.join(dir2, 'file.txt'), 'existing file');
      fs.writeFileSync(path.join(dir2, 'new-file.txt'), 'new content');

      const diff = getDiff(dir1, dir2);
      expect(diff).toContain('new-file.txt');
      expect(diff).toContain('new content');
    });
  });

  describe('isGitRepo', () => {
    it('should return false for non-git directory', () => {
      expect(isGitRepo(tempDir)).toBe(false);
    });

    it('should return true for git repository', () => {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: tempDir, stdio: 'pipe' });

      expect(isGitRepo(tempDir)).toBe(true);
    });
  });

  describe('isRepoClean', () => {
    it('should return true for non-git directory', () => {
      expect(isRepoClean(tempDir)).toBe(true);
    });

    it('should return true for clean git repository', () => {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: tempDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'pipe' });

      expect(isRepoClean(tempDir)).toBe(true);
    });

    it('should return false for dirty git repository', () => {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: tempDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'pipe' });

      // Make a change
      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'modified content');

      expect(isRepoClean(tempDir)).toBe(false);
    });

    it('should allow untracked files when allowUntrackedFiles is true', () => {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: tempDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'pipe' });

      fs.writeFileSync(path.join(tempDir, 'file.txt'), 'content');
      execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'pipe' });

      // Add untracked file
      fs.writeFileSync(path.join(tempDir, 'untracked.txt'), 'untracked');

      expect(isRepoClean(tempDir, false)).toBe(false);
      expect(isRepoClean(tempDir, true)).toBe(true);
    });
  });
});
