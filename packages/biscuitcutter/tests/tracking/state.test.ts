/**
 * Tests for template state management utilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import {
  getStateFile,
  readTemplateState,
  writeTemplateState,
  cleanPrivateVariables,
  getSkipPaths,
  TemplateState,
  STATE_FILE,
} from '../../src/core/tracking';
import { TemplateStateNotFoundError, TemplateStateExistsError } from '../../src/utils/exceptions';

describe('Template State', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-state-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getStateFile', () => {
    it('should return the path to .biscuitcutter.json when it exists', () => {
      const stateFile = path.join(tempDir, STATE_FILE);
      fs.writeFileSync(stateFile, '{}');

      const result = getStateFile(tempDir, true);
      expect(result).toBe(stateFile);
    });

    it('should throw TemplateStateNotFoundError when file does not exist', () => {
      expect(() => getStateFile(tempDir, true)).toThrow(TemplateStateNotFoundError);
    });

    it('should return path when file does not exist and mustExist=false', () => {
      const result = getStateFile(tempDir, false);
      expect(result).toBe(path.join(tempDir, STATE_FILE));
    });

    it('should throw TemplateStateExistsError when file exists and mustExist=false', () => {
      const stateFile = path.join(tempDir, STATE_FILE);
      fs.writeFileSync(stateFile, '{}');

      expect(() => getStateFile(tempDir, false)).toThrow(TemplateStateExistsError);
    });
  });

  describe('readTemplateState', () => {
    it('should read and parse template state from .biscuitcutter.json', () => {
      const state: TemplateState = {
        template: 'https://github.com/example/template',
        commit: 'abc123',
        checkout: 'main',
        context: {
          project_name: 'my_project',
          _template: 'https://github.com/example/template',
        },
        directory: null,
      };

      fs.writeFileSync(
        path.join(tempDir, STATE_FILE),
        JSON.stringify(state, null, 2),
      );

      const result = readTemplateState(tempDir);
      expect(result).toEqual(state);
    });
  });

  describe('writeTemplateState', () => {
    it('should write template state to .biscuitcutter.json', () => {
      const state: TemplateState = {
        template: 'https://github.com/example/template',
        commit: 'abc123',
        checkout: 'main',
        context: {
          project_name: 'my_project',
        },
        directory: null,
      };

      writeTemplateState(tempDir, state);

      const content = fs.readFileSync(
        path.join(tempDir, STATE_FILE),
        'utf-8',
      );
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(state);
    });
  });

  describe('cleanPrivateVariables', () => {
    it('should remove private variables except _commit and _template', () => {
      const state: TemplateState = {
        template: 'https://github.com/example/template',
        commit: 'abc123',
        checkout: null,
        context: {
          project_name: 'my_project',
          _template: 'https://github.com/example/template',
          _commit: 'abc123',
          _private_var: 'should be removed',
          _another_private: 'also removed',
        },
        directory: null,
      };

      cleanPrivateVariables(state);

      expect(state.context).toEqual({
        project_name: 'my_project',
        _template: 'https://github.com/example/template',
        _commit: 'abc123',
      });
    });
  });

  describe('getSkipPaths', () => {
    it('should return skip paths from template state', () => {
      const state: TemplateState = {
        template: 'https://github.com/example/template',
        commit: 'abc123',
        checkout: null,
        context: {},
        directory: null,
        skip: ['README.md', '*.lock'],
      };

      const result = getSkipPaths(state, tempDir);
      expect(result.has('README.md')).toBe(true);
      expect(result.has('*.lock')).toBe(true);
    });

    it('should include skip paths from package.json biscuitcutter config', () => {
      const state: TemplateState = {
        template: 'https://github.com/example/template',
        commit: 'abc123',
        checkout: null,
        context: {},
        directory: null,
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          biscuitcutter: {
            skip: ['node_modules/', 'dist/'],
          },
        }),
      );

      const result = getSkipPaths(state, tempDir);
      expect(result.has('node_modules/')).toBe(true);
      expect(result.has('dist/')).toBe(true);
    });
  });
});
