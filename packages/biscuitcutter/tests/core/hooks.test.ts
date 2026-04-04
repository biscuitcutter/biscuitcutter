/**
 * Tests for BiscuitCutter hooks module.
 */
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { findHook, runScript, validHook } from '../../src/core/hooks';
import { FailedHookError } from '../../src/utils/exceptions';

describe('validHook', () => {
  it('should return true for valid pre_gen_project.py', () => {
    expect(validHook('pre_gen_project.py', 'pre_gen_project')).toBe(true);
  });

  it('should return true for valid post_gen_project.sh', () => {
    expect(validHook('post_gen_project.sh', 'post_gen_project')).toBe(true);
  });

  it('should return true for pre_prompt.py', () => {
    expect(validHook('pre_prompt.py', 'pre_prompt')).toBe(true);
  });

  it('should return false for backup files (ending with ~)', () => {
    expect(validHook('pre_gen_project.py~', 'pre_gen_project')).toBe(false);
  });

  it('should return false for mismatched hook name', () => {
    expect(validHook('pre_gen_project.py', 'post_gen_project')).toBe(false);
  });

  it('should return false for unsupported hook names', () => {
    expect(validHook('custom_hook.py', 'custom_hook')).toBe(false);
  });
});

describe('findHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-hooks-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should return null when hooks dir does not exist', () => {
    const result = findHook('pre_gen_project', path.join(tmpDir, 'hooks'));
    expect(result).toBeNull();
  });

  it('should return null when no valid hooks exist', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    fs.mkdirSync(hooksDir);
    fs.writeFileSync(path.join(hooksDir, 'pre_gen_project.py~'), 'backup');

    const result = findHook('pre_gen_project', hooksDir);
    expect(result).toBeNull();
  });

  it('should find a valid hook script', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    fs.mkdirSync(hooksDir);
    fs.writeFileSync(
      path.join(hooksDir, 'pre_gen_project.py'),
      '#!/usr/bin/env python\nprint("hello")',
    );

    const result = findHook('pre_gen_project', hooksDir);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]).toContain('pre_gen_project.py');
  });

  it('should find shell hooks', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    fs.mkdirSync(hooksDir);
    fs.writeFileSync(
      path.join(hooksDir, 'post_gen_project.sh'),
      '#!/bin/bash\necho hello',
    );

    const result = findHook('post_gen_project', hooksDir);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0]).toContain('post_gen_project.sh');
  });

  it('should ignore backup hook files', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    fs.mkdirSync(hooksDir);
    fs.writeFileSync(
      path.join(hooksDir, 'pre_gen_project.py~'),
      '#!/usr/bin/env python\nprint("backup")',
    );
    fs.writeFileSync(
      path.join(hooksDir, 'post_gen_project.py~'),
      '#!/usr/bin/env python\nprint("backup")',
    );

    expect(findHook('pre_gen_project', hooksDir)).toBeNull();
    expect(findHook('post_gen_project', hooksDir)).toBeNull();
  });
});

describe('runScript', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-hooks-run-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should execute a shell script successfully', () => {
    const scriptPath = path.join(tmpDir, 'test.sh');
    fs.writeFileSync(
      scriptPath,
      '#!/bin/bash\necho "hello" > output.txt\n',
    );
    fs.chmodSync(scriptPath, 0o755);

    expect(() => runScript(scriptPath, tmpDir)).not.toThrow();
    expect(
      fs.existsSync(path.join(tmpDir, 'output.txt')),
    ).toBe(true);
  });

  it('should throw FailedHookError when script fails', () => {
    const scriptPath = path.join(tmpDir, 'fail.sh');
    fs.writeFileSync(scriptPath, '#!/bin/bash\nexit 1\n');
    fs.chmodSync(scriptPath, 0o755);

    expect(() => runScript(scriptPath, tmpDir)).toThrow(FailedHookError);
  });

  it('should execute a node script', () => {
    const scriptPath = path.join(tmpDir, 'test.js');
    fs.writeFileSync(
      scriptPath,
      'const fs = require("fs");\nfs.writeFileSync("node_output.txt", "hello");\n',
    );

    expect(() => runScript(scriptPath, tmpDir)).not.toThrow();
    expect(
      fs.existsSync(path.join(tmpDir, 'node_output.txt')),
    ).toBe(true);
  });
});
