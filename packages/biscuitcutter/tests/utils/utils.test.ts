/**
 * Tests for BiscuitCutter utils module.
 */
import {
  describe, it, expect, afterEach,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  rmtree,
  makeSurePathExists,
  workIn,
  makeExecutable,
  createEnvWithContext,
} from '../../src/utils/utils';

describe('rmtree', () => {
  it('should remove a directory and its contents', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-test-'));
    const subDir = path.join(tmpDir, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'file.txt'), 'content');

    expect(fs.existsSync(tmpDir)).toBe(true);
    rmtree(tmpDir);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it('should not throw on non-existent directory', () => {
    expect(() => rmtree('/tmp/non-existent-dir-biscuitcutter-test')).not.toThrow();
  });
});

describe('makeSurePathExists', () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should create a directory if it does not exist', () => {
    tmpDir = path.join(os.tmpdir(), `biscuitcutter-test-${Date.now()}`);
    const deepPath = path.join(tmpDir, 'a', 'b', 'c');
    expect(fs.existsSync(deepPath)).toBe(false);
    makeSurePathExists(deepPath);
    expect(fs.existsSync(deepPath)).toBe(true);
    expect(fs.statSync(deepPath).isDirectory()).toBe(true);
  });

  it('should not throw if directory already exists', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-test-'));
    expect(() => makeSurePathExists(tmpDir)).not.toThrow();
  });
});

describe('workIn', () => {
  it('should change to the specified directory and change back', () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-test-'));

    try {
      const result = workIn(tmpDir, () => {
        expect(process.cwd()).toBe(fs.realpathSync(tmpDir));
        return 42;
      });
      expect(result).toBe(42);
      expect(process.cwd()).toBe(originalCwd);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should not change directory when dirname is null', () => {
    const originalCwd = process.cwd();
    workIn(null, () => {
      expect(process.cwd()).toBe(originalCwd);
    });
  });

  it('should restore directory even on exception', () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-test-'));

    try {
      expect(() => workIn(tmpDir, () => {
        throw new Error('test error');
      })).toThrow('test error');
      expect(process.cwd()).toBe(originalCwd);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('makeExecutable', () => {
  it('should make a file executable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-test-'));
    const scriptPath = path.join(tmpDir, 'script.sh');
    fs.writeFileSync(scriptPath, '#!/bin/bash\necho hello');

    try {
      makeExecutable(scriptPath);
      const { mode } = fs.statSync(scriptPath);
      expect(mode & 0o100).toBeTruthy(); // owner execute bit
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('createEnvWithContext', () => {
  it('should create a nunjucks environment from context', () => {
    const env = createEnvWithContext({ biscuitcutter: { name: 'test' } });
    expect(env).toBeDefined();
    const result = env.renderString('{{ name }}', { name: 'World' });
    expect(result).toBe('World');
  });
});
