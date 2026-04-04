/**
 * Tests for BiscuitCutter replay module.
 */
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { dump, load, getFileName } from '../../src/core/replay';

describe('getFileName', () => {
  it('should return correct path with .json extension', () => {
    const result = getFileName('/tmp/replay', 'my-template');
    expect(result).toBe('/tmp/replay/my-template.json');
  });

  it('should not double .json extension', () => {
    const result = getFileName('/tmp/replay', 'my-template.json');
    expect(result).toBe('/tmp/replay/my-template.json');
  });
});

describe('dump', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-replay-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should write context to replay file', () => {
    const context = {
      biscuitcutter: {
        email: 'test@example.com',
        full_name: 'Test User',
        version: '0.1.0',
      },
    };

    dump(tmpDir, 'my-template', context);

    const replayFile = path.join(tmpDir, 'my-template.json');
    expect(fs.existsSync(replayFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(replayFile, 'utf-8'));
    expect(content.biscuitcutter.email).toBe('test@example.com');
    expect(content.biscuitcutter.full_name).toBe('Test User');
  });

  it('should throw if context has no cookiecutter key', () => {
    expect(() => dump(tmpDir, 'template', { foo: 'bar' })).toThrow(
      'Context is required to contain a biscuitcutter key',
    );
  });

  it('should create replay directory if it does not exist', () => {
    const replayDir = path.join(tmpDir, 'new-replay-dir');
    const context = { biscuitcutter: { key: 'value' } };

    dump(replayDir, 'template', context);
    expect(fs.existsSync(replayDir)).toBe(true);
  });
});

describe('load', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-replay-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should load context from replay file', () => {
    const context = {
      biscuitcutter: {
        email: 'test@example.com',
        full_name: 'Test User',
      },
    };

    const replayFile = path.join(tmpDir, 'my-template.json');
    fs.writeFileSync(replayFile, JSON.stringify(context), 'utf-8');

    const loaded = load(tmpDir, 'my-template');
    expect(loaded.biscuitcutter.email).toBe('test@example.com');
    expect(loaded.biscuitcutter.full_name).toBe('Test User');
  });

  it('should throw if file does not contain cookiecutter key', () => {
    const replayFile = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(replayFile, JSON.stringify({ foo: 'bar' }), 'utf-8');

    expect(() => load(tmpDir, 'bad')).toThrow(
      'Context is required to contain a biscuitcutter key',
    );
  });

  it('should throw if file does not exist', () => {
    expect(() => load(tmpDir, 'nonexistent')).toThrow();
  });

  it('should throw if file contains invalid JSON', () => {
    const replayFile = path.join(tmpDir, 'invalid.json');
    fs.writeFileSync(replayFile, 'not valid json', 'utf-8');

    expect(() => load(tmpDir, 'invalid')).toThrow();
  });

  it('should roundtrip with dump', () => {
    const context = {
      biscuitcutter: {
        email: 'test@example.com',
        full_name: 'Test User',
        version: '1.0.0',
        github_username: 'testuser',
      },
    };

    dump(tmpDir, 'roundtrip', context);
    const loaded = load(tmpDir, 'roundtrip');

    expect(loaded).toEqual(context);
  });
});
