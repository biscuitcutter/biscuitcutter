/**
 * Tests for BiscuitCutter prompt module.
 */
import {
  describe, it, expect,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  renderVariable,
  promptForConfig,
  processYesNoResponse,
} from '../../src/core/prompt';
import { createStrictEnvironment } from '../../src/templating';
import { UndefinedVariableInTemplateError } from '../../src/utils/exceptions';

// Need these imports at top level for promptAndDelete tests

describe('processYesNoResponse', () => {
  it.each(['1', 'true', 't', 'yes', 'y', 'on'])(
    'should return true for "%s"',
    (value) => {
      expect(processYesNoResponse(value)).toBe(true);
    },
  );

  it.each(['0', 'false', 'f', 'no', 'n', 'off'])(
    'should return false for "%s"',
    (value) => {
      expect(processYesNoResponse(value)).toBe(false);
    },
  );

  it('should throw on invalid input', () => {
    expect(() => processYesNoResponse('maybe')).toThrow();
  });

  it('should handle case insensitivity', () => {
    expect(processYesNoResponse('YES')).toBe(true);
    expect(processYesNoResponse('True')).toBe(true);
    expect(processYesNoResponse('NO')).toBe(false);
    expect(processYesNoResponse('False')).toBe(false);
  });
});

describe('renderVariable', () => {
  it('should return null/undefined/boolean as-is', () => {
    const env = createStrictEnvironment();
    expect(renderVariable(env, null, {})).toBeNull();
    expect(renderVariable(env, undefined, {})).toBeUndefined();
    expect(renderVariable(env, true, {})).toBe(true);
    expect(renderVariable(env, false, {})).toBe(false);
  });

  it('should render string with template variables', () => {
    const env = createStrictEnvironment();
    const result = renderVariable(env, '{{ cookiecutter.project_name }}', {
      project_name: 'MyProject',
    });
    expect(result).toBe('MyProject');
  });

  it('should render numbers to strings', () => {
    const env = createStrictEnvironment();
    const result = renderVariable(env, 42, { project_name: 'Test' });
    expect(result).toBe('42');
  });

  it('should render arrays', () => {
    const env = createStrictEnvironment();
    const result = renderVariable(
      env,
      ['hello', '{{ cookiecutter.name }}', 'world'],
      { name: 'Test' },
    );
    expect(result).toEqual(['hello', 'Test', 'world']);
  });

  it('should render objects recursively', () => {
    const env = createStrictEnvironment();
    const result = renderVariable(
      env,
      { key: '{{ cookiecutter.name }}', nested: { deep: '{{ cookiecutter.name }}' } },
      { name: 'Test' },
    );
    expect(result).toEqual({ key: 'Test', nested: { deep: 'Test' } });
  });
});

describe('promptForConfig', () => {
  it('should return context values directly with no_input', async () => {
    const context = {
      biscuitcutter: {
        project_name: 'MyProject',
        version: '1.0.0',
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.project_name).toBe('MyProject');
    expect(result.version).toBe('1.0.0');
  });

  it('should render template variables with no_input', async () => {
    const context = {
      biscuitcutter: {
        project_name: 'MyProject',
        slug: '{{ cookiecutter.project_name | lower }}',
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.project_name).toBe('MyProject');
    expect(result.slug).toBe('myproject');
  });

  it('should return first choice for list variables with no_input', async () => {
    const context = {
      biscuitcutter: {
        license: ['MIT', 'BSD', 'Apache'],
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.license).toBe('MIT');
  });

  it('should preserve private variables (single underscore) without rendering', async () => {
    const context = {
      biscuitcutter: {
        project_name: 'Skip render',
        _skip_jinja_template: '{{cookiecutter.project_name}}',
        _skip_float: 123.25,
        _skip_integer: 123,
        _skip_boolean: true,
        _skip_nested: true,
      },
    };
    const result = await promptForConfig(context, true);
    expect(result._skip_jinja_template).toBe('{{cookiecutter.project_name}}');
    expect(result._skip_float).toBe(123.25);
    expect(result._skip_integer).toBe(123);
    expect(result._skip_boolean).toBe(true);
    expect(result.project_name).toBe('Skip render');
  });

  it('should render double-underscore private variables', async () => {
    const context = {
      biscuitcutter: {
        foo: 'Hello world',
        bar: 123,
        rendered_foo: '{{ cookiecutter.foo | lower }}',
        _hidden_foo: '{{ cookiecutter.foo | lower }}',
        __rendered_hidden_foo: '{{ cookiecutter.foo | lower }}',
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.foo).toBe('Hello world');
    expect(result.bar).toBe('123');
    expect(result.rendered_foo).toBe('hello world');
    expect(result._hidden_foo).toBe('{{ cookiecutter.foo | lower }}');
    expect(result.__rendered_hidden_foo).toBe('hello world');
  });

  it('should handle boolean variables with no_input', async () => {
    const context = {
      biscuitcutter: {
        run_as_docker: true,
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.run_as_docker).toBe(true);
  });

  it('should handle dict/object variables with no_input', async () => {
    const context = {
      biscuitcutter: {
        project_name: 'Test',
        details: {
          key: 'value',
          other_name: '{{ cookiecutter.project_name }}',
        },
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.details.key).toBe('value');
    expect(result.details.other_name).toBe('Test');
  });

  it('should handle deep nested dicts with no_input', async () => {
    const context = {
      biscuitcutter: {
        project_name: 'Slartibartfast',
        details: {
          key: 'value',
          integer_key: 37,
          other_name: '{{cookiecutter.project_name}}',
          dict_key: {
            deep_key: 'deep_value',
            deep_integer: 42,
            deep_other_name: '{{cookiecutter.project_name}}',
            deep_list: [
              'deep value 1',
              '{{cookiecutter.project_name}}',
              'deep value 3',
            ],
          },
          list_key: [
            'value 1',
            '{{cookiecutter.project_name}}',
            'value 3',
          ],
        },
      },
    };
    const result = await promptForConfig(context, true);
    expect(result.project_name).toBe('Slartibartfast');
    expect(result.details.key).toBe('value');
    expect(result.details.integer_key).toBe('37');
    expect(result.details.other_name).toBe('Slartibartfast');
    expect(result.details.dict_key.deep_key).toBe('deep_value');
    expect(result.details.dict_key.deep_integer).toBe('42');
    expect(result.details.dict_key.deep_other_name).toBe('Slartibartfast');
    expect(result.details.dict_key.deep_list).toEqual([
      'deep value 1',
      'Slartibartfast',
      'deep value 3',
    ]);
    expect(result.details.list_key).toEqual([
      'value 1',
      'Slartibartfast',
      'value 3',
    ]);
  });

  it('should exclude __prompts__ from output', async () => {
    const context = {
      biscuitcutter: {
        project_name: 'Test',
        __prompts__: { project_name: 'Project name' },
      },
    };
    const result = await promptForConfig(context, true);
    expect(result).not.toHaveProperty('__prompts__');
    expect(result.project_name).toBe('Test');
  });

  it('should throw UndefinedVariableInTemplateError on undefined var', async () => {
    const context = {
      biscuitcutter: {
        foo: '{{cookiecutter.nope}}',
      },
    };
    await expect(
      promptForConfig(context, true),
    ).rejects.toThrow(UndefinedVariableInTemplateError);
  });

  it('should throw on undefined var in list choices', async () => {
    const context = {
      biscuitcutter: {
        foo: ['123', '{{cookiecutter.nope}}', '456'],
      },
    };
    await expect(
      promptForConfig(context, true),
    ).rejects.toThrow(UndefinedVariableInTemplateError);
  });

  it('should throw on undefined var in dict key', async () => {
    const context = {
      biscuitcutter: {
        foo: { '{{cookiecutter.nope}}': 'value' },
      },
    };
    await expect(
      promptForConfig(context, true),
    ).rejects.toThrow(UndefinedVariableInTemplateError);
  });

  it('should throw on undefined var in dict value', async () => {
    const context = {
      biscuitcutter: {
        foo: { key: '{{cookiecutter.nope}}' },
      },
    };
    await expect(
      promptForConfig(context, true),
    ).rejects.toThrow(UndefinedVariableInTemplateError);
  });
});

describe('promptAndDelete', () => {
  it('should delete directory with no_input', async () => {
    const { promptAndDelete } = await import('../../src/core/prompt');
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'biscuitcutter-prompt-del-'),
    );

    const deleted = await promptAndDelete(tmpDir, true);
    expect(deleted).toBe(true);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it('should delete file with no_input', async () => {
    const { promptAndDelete } = await import('../../src/core/prompt');
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'biscuitcutter-prompt-del-'),
    );
    const tmpFile = path.join(tmpDir, 'test.zip');
    fs.writeFileSync(tmpFile, 'content');

    const deleted = await promptAndDelete(tmpFile, true);
    expect(deleted).toBe(true);
    expect(fs.existsSync(tmpFile)).toBe(false);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
