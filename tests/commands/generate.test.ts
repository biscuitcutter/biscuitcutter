/**
 * Tests for the `generate` (biscuitcutter) command.
 *
 * Tests the biscuitcutter() function which is the main entry point
 * for creating projects from templates, equivalent to the CLI `generate` command.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import { biscuitcutter } from '../../src/core/main';
import { readTemplateState, STATE_FILE } from '../../src/core/tracking';
import { InvalidModeError } from '../../src/utils/exceptions';

const FIXTURE_DIR = path.join(__dirname, '..', '_fixtures', 'fake-repo-simple');

describe('generate command (biscuitcutter)', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-generate-test-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('should generate a project from a local template', async () => {
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    expect(fs.existsSync(projectDir)).toBe(true);

    const readmePath = path.join(projectDir, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('# My Test Project');
    expect(content).toContain('Version: 0.1.0');
  });

  it('should render template variables in directory and file names', async () => {
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    // The project_slug is derived from project_name via template expression
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(path.basename(projectDir)).toBe('my-test-project');
  });

  it('should apply extra context overrides', async () => {
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
      extraContext: { project_name: 'Override Name' },
    });

    expect(path.basename(projectDir)).toBe('override-name');

    const readmePath = path.join(projectDir, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('# Override Name');
  });

  it('should write a .biscuitcutter.json state file', async () => {
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    const stateFile = path.join(projectDir, STATE_FILE);
    expect(fs.existsSync(stateFile)).toBe(true);

    const state = readTemplateState(projectDir);
    expect(state.template).toBe(FIXTURE_DIR);
    expect(state.context.project_name).toBe('My Test Project');
  });

  it('should throw InvalidModeError when replay and noInput are both set', async () => {
    await expect(
      biscuitcutter({
        template: FIXTURE_DIR,
        outputDir,
        noInput: true,
        replay: true,
      }),
    ).rejects.toThrow(InvalidModeError);
  });

  it('should throw InvalidModeError when replay and extraContext are both set', async () => {
    await expect(
      biscuitcutter({
        template: FIXTURE_DIR,
        outputDir,
        replay: true,
        extraContext: { key: 'value' },
      }),
    ).rejects.toThrow(InvalidModeError);
  });

  it('should use default values for template variables when noInput is true', async () => {
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    const state = readTemplateState(projectDir);
    expect(state.context.project_name).toBe('My Test Project');
    expect(state.context.version).toBe('0.1.0');
  });

  it('should support overwriteIfExists', async () => {
    // Generate once
    await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    // Generate again with overwrite
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
      overwriteIfExists: true,
    });

    expect(fs.existsSync(projectDir)).toBe(true);
  });

  it('should render package.json template variables', async () => {
    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir,
      noInput: true,
    });

    const packageJsonPath = path.join(projectDir, 'package.json');
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.name).toBe('my-test-project');
    expect(packageJson.version).toBe('0.1.0');
  });

  it('should generate files in the specified output directory', async () => {
    const customOutput = path.join(outputDir, 'nested', 'output');
    fs.mkdirSync(customOutput, { recursive: true });

    const projectDir = await biscuitcutter({
      template: FIXTURE_DIR,
      outputDir: customOutput,
      noInput: true,
    });

    expect(projectDir.startsWith(customOutput)).toBe(true);
  });
});
