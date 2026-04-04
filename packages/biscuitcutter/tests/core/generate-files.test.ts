/**
 * Tests for BiscuitCutter generateFiles functionality.
 */
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateFiles, renderAndCreateDir } from '../../src/core/generate';
import {
  NonTemplatedInputDirError,
  OutputDirExistsError,
  UndefinedVariableInTemplateError,
  EmptyDirNameError,
} from '../../src/utils/exceptions';
import { createStrictEnvironment } from '../../src/templating';

const FIXTURES_DIR = path.join(__dirname, '../_fixtures');

describe('generateFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-gen-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should throw NonTemplatedInputDirError for nontemplated repo', () => {
    expect(() => generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files-nontemplated'),
      { biscuitcutter: { food: 'pizza' } },
      tmpDir,
    )).toThrow(NonTemplatedInputDirError);
  });

  it('should generate files with unicode context', () => {
    generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files'),
      { biscuitcutter: { food: 'pizzä' } },
      tmpDir,
    );

    const simpleFile = path.join(tmpDir, 'inputpizzä', 'simple.txt');
    expect(fs.existsSync(simpleFile)).toBe(true);
    const content = fs.readFileSync(simpleFile, 'utf-8');
    expect(content).toBe('I eat pizzä\n');
  });

  it('should generate files with linux newline', () => {
    generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files'),
      { biscuitcutter: { food: 'pizzä' } },
      tmpDir,
    );

    const newlineFile = path.join(tmpDir, 'inputpizzä', 'simple-with-newline.txt');
    expect(fs.existsSync(newlineFile)).toBe(true);
    const content = fs.readFileSync(newlineFile, 'utf-8');
    expect(content).toContain('newline is LF');
  });

  it('should generate files from absolute path', () => {
    generateFiles(
      path.resolve(path.join(FIXTURES_DIR, 'test-generate-files')),
      { biscuitcutter: { food: 'pizzä' } },
      tmpDir,
    );

    expect(
      fs.existsSync(path.join(tmpDir, 'inputpizzä', 'simple.txt')),
    ).toBe(true);
  });

  it('should create output in custom output_dir', () => {
    const outputDir = path.join(tmpDir, 'custom_output_dir');
    fs.mkdirSync(outputDir);

    const projectDir = generateFiles(
      path.resolve(path.join(FIXTURES_DIR, 'test-generate-files')),
      { biscuitcutter: { food: 'pizzä' } },
      outputDir,
    );

    expect(
      fs.existsSync(path.join(outputDir, 'inputpizzä', 'simple.txt')),
    ).toBe(true);
    expect(projectDir).toContain('inputpizzä');
  });

  it('should preserve file permissions', () => {
    generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files-permissions'),
      { biscuitcutter: { permissions: 'permissions' } },
      tmpDir,
    );

    const simpleFile = path.join(tmpDir, 'inputpermissions', 'simple.txt');
    const scriptFile = path.join(tmpDir, 'inputpermissions', 'script.sh');
    expect(fs.existsSync(simpleFile)).toBe(true);
    expect(fs.existsSync(scriptFile)).toBe(true);

    // Check that source and output file permissions match
    const srcSimple = path.join(
      FIXTURES_DIR,
      'test-generate-files-permissions',
      'input{{biscuitcutter.permissions}}',
      'simple.txt',
    );
    const srcScript = path.join(
      FIXTURES_DIR,
      'test-generate-files-permissions',
      'input{{biscuitcutter.permissions}}',
      'script.sh',
    );
    expect(fs.statSync(simpleFile).mode).toBe(fs.statSync(srcSimple).mode);
    expect(fs.statSync(scriptFile).mode).toBe(fs.statSync(srcScript).mode);
  });

  it('should skip existing files with skip_if_file_exists and overwrite', () => {
    const projectDir = path.join(tmpDir, 'inputpizzä');
    fs.mkdirSync(projectDir, { recursive: true });
    const simpleFile = path.join(projectDir, 'simple.txt');
    fs.writeFileSync(simpleFile, 'temp');

    generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files'),
      { biscuitcutter: { food: 'pizzä' } },
      tmpDir,
      true, // overwriteIfExists
      true, // skipIfFileExists
    );

    const content = fs.readFileSync(simpleFile, 'utf-8');
    expect(content).toBe('temp'); // Should not be overwritten
  });

  it('should throw when output dir exists without overwrite flag', () => {
    const projectDir = path.join(tmpDir, 'inputpizzä');
    fs.mkdirSync(projectDir, { recursive: true });
    const simpleFile = path.join(projectDir, 'simple.txt');
    fs.writeFileSync(simpleFile, 'temp');

    expect(() => generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files'),
      { biscuitcutter: { food: 'pizzä' } },
      tmpDir,
      false, // overwriteIfExists
      true, // skipIfFileExists
    )).toThrow(OutputDirExistsError);

    // Original file should still be intact
    expect(fs.readFileSync(simpleFile, 'utf-8')).toBe('temp');
  });

  it('should overwrite existing files with overwrite flag', () => {
    const projectDir = path.join(tmpDir, 'inputpizzä');
    fs.mkdirSync(projectDir, { recursive: true });
    const simpleFile = path.join(projectDir, 'simple.txt');
    fs.writeFileSync(simpleFile, 'temp');

    generateFiles(
      path.join(FIXTURES_DIR, 'test-generate-files'),
      { biscuitcutter: { food: 'pizzä' } },
      tmpDir,
      true, // overwriteIfExists
    );

    const content = fs.readFileSync(simpleFile, 'utf-8');
    expect(content).toBe('I eat pizzä\n');
  });
});

describe('renderAndCreateDir', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-render-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should throw EmptyDirNameError for empty directory name', () => {
    const env = createStrictEnvironment();
    expect(() => renderAndCreateDir('', { biscuitcutter: {} }, tmpDir, env)).toThrow(EmptyDirNameError);
  });

  it('should create a new directory', () => {
    const env = createStrictEnvironment();
    const [dirPath, isNew] = renderAndCreateDir(
      'myproject',
      { biscuitcutter: {} },
      tmpDir,
      env,
    );
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(isNew).toBe(true);
  });

  it('should throw when directory exists without overwrite', () => {
    const env = createStrictEnvironment();
    fs.mkdirSync(path.join(tmpDir, 'existing'));
    expect(() => renderAndCreateDir('existing', { biscuitcutter: {} }, tmpDir, env)).toThrow(OutputDirExistsError);
  });

  it('should not throw when directory exists with overwrite', () => {
    const env = createStrictEnvironment();
    fs.mkdirSync(path.join(tmpDir, 'existing'));
    const [dirPath, isNew] = renderAndCreateDir(
      'existing',
      { biscuitcutter: {} },
      tmpDir,
      env,
      true,
    );
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(isNew).toBe(false);
  });

  it('should render template variables in directory name', () => {
    const env = createStrictEnvironment();
    const [dirPath] = renderAndCreateDir(
      '{{ name }}-project',
      { name: 'my' },
      tmpDir,
      env,
    );
    expect(dirPath).toContain('my-project');
    expect(fs.existsSync(dirPath)).toBe(true);
  });
});

describe('UndefinedVariable Errors in generateFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-undef-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const undefinedContext = {
    biscuitcutter: {
      project_slug: 'testproject',
      github_username: 'hackebrot',
    },
  };

  it('should raise error for undefined variable in file name', () => {
    expect(() => generateFiles(
      path.join(FIXTURES_DIR, 'undefined-variable', 'file-name'),
      undefinedContext,
      tmpDir,
    )).toThrow(UndefinedVariableInTemplateError);

    expect(
      fs.existsSync(path.join(tmpDir, 'testproject')),
    ).toBe(false);
  });

  it('should raise error for undefined variable in file content', () => {
    expect(() => generateFiles(
      path.join(FIXTURES_DIR, 'undefined-variable', 'file-content'),
      undefinedContext,
      tmpDir,
    )).toThrow(UndefinedVariableInTemplateError);
  });

  it('should raise error for undefined variable in dir name', () => {
    expect(() => generateFiles(
      path.join(FIXTURES_DIR, 'undefined-variable', 'dir-name'),
      undefinedContext,
      tmpDir,
    )).toThrow(UndefinedVariableInTemplateError);
  });

  it('should keep project dir on failure when flag is set', () => {
    try {
      generateFiles(
        path.join(FIXTURES_DIR, 'undefined-variable', 'dir-name'),
        undefinedContext,
        tmpDir,
        false, // overwriteIfExists
        false, // skipIfFileExists
        true, // acceptHooks
        true, // keepProjectOnFailure
      );
    } catch {
      // Expected to throw
    }
    expect(
      fs.existsSync(path.join(tmpDir, 'testproject')),
    ).toBe(true);
  });

  it('should raise error for undefined project directory', () => {
    expect(() => generateFiles(
      path.join(FIXTURES_DIR, 'undefined-variable', 'dir-name'),
      {},
      tmpDir,
    )).toThrow(UndefinedVariableInTemplateError);
  });
});
