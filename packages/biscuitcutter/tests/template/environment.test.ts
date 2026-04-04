/**
 * Tests for BiscuitCutter environment module.
 */
import { describe, it, expect } from 'vitest';
import { createStrictEnvironment } from '../../src/templating';

describe('Environment', () => {
  it('should create a strict nunjucks environment', () => {
    const env = createStrictEnvironment();
    expect(env).toBeDefined();
  });

  it('should throw on undefined variables', () => {
    const env = createStrictEnvironment();
    expect(() => env.renderString('{{ undefined_var }}', {})).toThrow();
  });

  it('should render defined variables', () => {
    const env = createStrictEnvironment();
    const result = env.renderString('Hello {{ name }}', { name: 'World' });
    expect(result).toBe('Hello World');
  });

  it('should have default extensions loaded', () => {
    const env = createStrictEnvironment();
    // jsonify filter should work
    const result = env.renderString('{{ data | jsonify }}', {
      data: { key: 'value' },
    });
    expect(result).toContain('key');
    expect(result).toContain('value');
  });

  it('should support custom jinja2 env vars from context', () => {
    const env = createStrictEnvironment({
      context: {
        biscuitcutter: {
          _jinja2_env_vars: {
            trimBlocks: true,
            lstripBlocks: true,
          },
        },
      },
    });
    expect(env).toBeDefined();
  });

  it('should warn about Python extensions but not crash', () => {
    const env = createStrictEnvironment({
      context: {
        biscuitcutter: {
          _extensions: ['jinja2_time.TimeExtension'],
        },
      },
    });
    expect(env).toBeDefined();
  });

  it('should process Python string manipulations (lower, replace)', () => {
    const env = createStrictEnvironment();
    const result = env.renderString(
      '{{ "HELLO world".lower().replace(" ", "_") }}',
      {},
    );
    expect(result).toBe('hello_world');
  });

  it('should process split, map("first"), join, and lower logic correctly', () => {
    const env = createStrictEnvironment();
    const result = env.renderString(
      '{{ cookiecutter.project_name.split(" ") | map("first") | join("") | lower }}',
      { cookiecutter: { project_name: 'My Awesome Project' } },
    );
    expect(result).toBe('map');
  });

  it('should render null values as "None" and throw on undefined to mimic Jinja2 StrictUndefined', () => {
    const env = createStrictEnvironment();
    // Verify null stringifies to 'None'
    const result = env.renderString('{% if val == null %}YES{% endif %} {{ val }}', { val: null });
    expect(result).toBe('YES None');
    // Verify that missing values still throw
    expect(() => env.renderString('{{ missing_value }}', {})).toThrow();
  });

  it('should support Jinja2 raw tags with whitespace strip modifiers', () => {
    const env = createStrictEnvironment();
    // Nunjucks doesn't natively support {% raw -%} or {% endraw -%} modifier strips.
    // We expect it to be parsed correctly without crashing.
    const result = env.renderString('{%- raw -%} {{ dont_evaluate_this }} {%- endraw -%}', {});
    expect(result).toBe(' {{ dont_evaluate_this }} ');
  });
});
