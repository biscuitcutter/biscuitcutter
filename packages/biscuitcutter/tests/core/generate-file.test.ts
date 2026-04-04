/**
 * Tests for BiscuitCutter generate file functionality.
 */
import {
  describe, it, expect, afterEach, beforeEach,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createStrictEnvironment } from '../../src/templating';
import { generateFile, isCopyOnlyPath } from '../../src/core/generate';

describe('isCopyOnlyPath', () => {
  it('should return true for matching copy_without_render patterns', () => {
    const context = {
      biscuitcutter: { _copy_without_render: ['*.html', 'images/*'] },
    };
    expect(isCopyOnlyPath('index.html', context)).toBe(true);
    expect(isCopyOnlyPath('images/logo.png', context)).toBe(true);
  });

  it('should return false for non-matching paths', () => {
    const context = {
      biscuitcutter: { _copy_without_render: ['*.html'] },
    };
    expect(isCopyOnlyPath('style.css', context)).toBe(false);
  });

  it('should return false when no copy_without_render list', () => {
    const context = { biscuitcutter: {} };
    expect(isCopyOnlyPath('index.html', context)).toBe(false);
  });
});

describe('generateFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-gen-file-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should render a template file', () => {
    // Create a simple template
    const inDir = path.join(tmpDir, 'templates');
    fs.mkdirSync(inDir);
    fs.writeFileSync(
      path.join(inDir, 'hello.txt'),
      'Hello {{ biscuitcutter.name }}!',
    );

    const outDir = path.join(tmpDir, 'output');
    fs.mkdirSync(outDir);

    const context = { biscuitcutter: { name: 'World' } };
    const env = createStrictEnvironment({ searchPaths: inDir });

    const originalCwd = process.cwd();
    process.chdir(inDir);
    try {
      generateFile(outDir, 'hello.txt', context, env);
    } finally {
      process.chdir(originalCwd);
    }

    const content = fs.readFileSync(path.join(outDir, 'hello.txt'), 'utf-8');
    expect(content).toBe('Hello World!');
  });

  it('should skip existing files when skipIfFileExists is true', () => {
    const inDir = path.join(tmpDir, 'templates');
    fs.mkdirSync(inDir);
    fs.writeFileSync(path.join(inDir, 'existing.txt'), 'New content');

    const outDir = path.join(tmpDir, 'output');
    fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, 'existing.txt'), 'Original content');

    const context = { biscuitcutter: {} };
    const env = createStrictEnvironment({ searchPaths: inDir });

    const originalCwd = process.cwd();
    process.chdir(inDir);
    try {
      generateFile(outDir, 'existing.txt', context, env, true);
    } finally {
      process.chdir(originalCwd);
    }

    const content = fs.readFileSync(
      path.join(outDir, 'existing.txt'),
      'utf-8',
    );
    expect(content).toBe('Original content');
  });

  it('should copy binary files without rendering', () => {
    const inDir = path.join(tmpDir, 'templates');
    fs.mkdirSync(inDir);

    // Create a file with null bytes (binary)
    const buffer = Buffer.alloc(100);
    buffer[0] = 0x89; // PNG header byte
    buffer[1] = 0x50;
    buffer[2] = 0x4e;
    buffer[3] = 0x47;
    buffer[50] = 0x00; // null byte
    fs.writeFileSync(path.join(inDir, 'image.png'), buffer);

    const outDir = path.join(tmpDir, 'output');
    fs.mkdirSync(outDir);

    const context = { biscuitcutter: {} };
    const env = createStrictEnvironment({ searchPaths: inDir });

    const originalCwd = process.cwd();
    process.chdir(inDir);
    try {
      generateFile(outDir, 'image.png', context, env);
    } finally {
      process.chdir(originalCwd);
    }

    const outFile = path.join(outDir, 'image.png');
    expect(fs.existsSync(outFile)).toBe(true);
    const outputBuffer = fs.readFileSync(outFile);
    expect(outputBuffer).toEqual(buffer);
  });
});
