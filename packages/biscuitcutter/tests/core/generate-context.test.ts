/**
 * Tests for BiscuitCutter generate context functionality.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  generateContext,
  applyOverwritesToContext,
} from '../../src/core/generate';
import { ContextDecodingError } from '../../src/utils/exceptions';

const CONTEXT_DIR = path.join(__dirname, '../_fixtures/test-generate-context');

describe('generateContext', () => {
  it('should load context from JSON file', () => {
    const contextFile = path.join(CONTEXT_DIR, 'test.json');
    const context = generateContext(contextFile);
    expect(context).toHaveProperty('test');
    expect(context.test).toEqual({ 1: 2, some_key: 'some_val' });
  });

  it('should use the filename stem as context key', () => {
    const contextFile = path.join(CONTEXT_DIR, 'test.json');
    const context = generateContext(contextFile);
    expect(Object.keys(context)).toContain('test');
  });

  it('should throw ContextDecodingError on invalid JSON', () => {
    const contextFile = path.join(CONTEXT_DIR, 'invalid-syntax.json');
    expect(() => generateContext(contextFile)).toThrow(ContextDecodingError);
  });

  it('should apply default context', () => {
    const contextFile = path.join(CONTEXT_DIR, 'choices_template.json');
    const context = generateContext(contextFile, {
      full_name: 'Overridden Name',
    });
    expect(context.choices_template.full_name).toBe('Overridden Name');
  });

  it('should apply extra context', () => {
    const contextFile = path.join(CONTEXT_DIR, 'choices_template.json');
    const context = generateContext(contextFile, null, {
      full_name: 'Extra Name',
    });
    expect(context.choices_template.full_name).toBe('Extra Name');
  });

  it('should handle non-ascii context', () => {
    const contextFile = path.join(CONTEXT_DIR, 'non_ascii.json');
    const context = generateContext(contextFile);
    expect(context.non_ascii.full_name).toBe('éèà');
  });

  it('should apply extra context over default context', () => {
    const contextFile = path.join(CONTEXT_DIR, 'choices_template.json');
    const context = generateContext(
      contextFile,
      { full_name: 'Default Name' },
      { full_name: 'Extra Name' },
    );
    expect(context.choices_template.full_name).toBe('Extra Name');
  });

  it('should handle nested dict context', () => {
    const contextFile = path.join(CONTEXT_DIR, 'nested_dict.json');
    const context = generateContext(contextFile);
    expect(context.nested_dict.project).toBeDefined();
    expect(context.nested_dict.project.name).toBe('Kivy Project');
  });

  it('should apply overwrites in nested dict', () => {
    const contextFile = path.join(CONTEXT_DIR, 'nested_dict.json');
    const context = generateContext(
      contextFile,
      {
        not_in_template: 'foobar',
        project: {
          description: 'My Kivy Project',
        },
      },
      {
        also_not_in_template: 'foobar2',
        github_username: 'hackebrot',
        project: {
          name: 'My Kivy Project',
        },
      },
    );
    expect(context.nested_dict.project.description).toBe('My Kivy Project');
    expect(context.nested_dict.project.name).toBe('My Kivy Project');
    expect(context.nested_dict.github_username).toBe('hackebrot');
  });
});

describe('applyOverwritesToContext', () => {
  function createTemplateContext() {
    return {
      full_name: 'Raphael Pierzina',
      github_username: 'hackebrot',
      project_name: 'Kivy Project',
      repo_name: '{{cookiecutter.project_name|lower}}',
      orientation: ['all', 'landscape', 'portrait'],
      deployment_regions: ['eu', 'us', 'ap'],
      deployments: {
        preprod: ['eu', 'us', 'ap'],
        prod: ['eu', 'us', 'ap'],
      },
    };
  }

  it('should overwrite simple string values', () => {
    const ctx = createTemplateContext();
    applyOverwritesToContext(ctx, { full_name: 'New Name' });
    expect(ctx.full_name).toBe('New Name');
  });

  it('should set default for choice variables', () => {
    const ctx = createTemplateContext();
    applyOverwritesToContext(ctx, { orientation: 'landscape' });
    expect(ctx.orientation[0]).toBe('landscape');
    expect(ctx.orientation).toContain('all');
    expect(ctx.orientation).toContain('portrait');
  });

  it('should throw on invalid choice overwrite', () => {
    const ctx = createTemplateContext();
    expect(() => applyOverwritesToContext(ctx, { orientation: 'foobar' })).toThrow();
  });

  it('should set multichoice values', () => {
    const ctx = createTemplateContext();
    applyOverwritesToContext(ctx, { deployment_regions: ['eu'] });
    expect(ctx.deployment_regions).toEqual(['eu']);
  });

  it('should throw on invalid multichoice values', () => {
    const ctx = createTemplateContext();
    expect(() => applyOverwritesToContext(ctx, { deployment_regions: ['na'] })).toThrow();
  });

  it('should throw on invalid additional multichoice values', () => {
    const ctx = createTemplateContext();
    expect(() => applyOverwritesToContext(ctx, { deployment_regions: ['eu', 'na'] })).toThrow();
  });

  it('should overwrite in nested dictionaries', () => {
    const ctx = createTemplateContext();
    applyOverwritesToContext(ctx, {
      deployments: { preprod: ['eu'], prod: ['ap'] },
    });
    expect(ctx.deployments.preprod).toEqual(['eu']);
    expect(ctx.deployments.prod).toEqual(['ap']);
  });

  it('should ignore variables not in context', () => {
    const ctx = createTemplateContext();
    applyOverwritesToContext(ctx, { nonexistent: 'value' });
    expect(ctx).not.toHaveProperty('nonexistent');
  });

  it('should add additional values when in dictionary variable', () => {
    const ctx: Record<string, any> = { key1: 'value1' };
    applyOverwritesToContext(ctx, { key2: 'value2' }, true);
    expect(ctx).toEqual({ key1: 'value1', key2: 'value2' });
  });

  describe('boolean string conversion', () => {
    const yesValues = ['1', 'true', 't', 'yes', 'y', 'on'];
    const noValues = ['0', 'false', 'f', 'no', 'n', 'off'];

    it.each(yesValues)(
      'should convert "%s" to true for boolean context value',
      (value) => {
        const ctx: Record<string, any> = { key: false };
        applyOverwritesToContext(ctx, { key: value });
        expect(ctx.key).toBe(true);
      },
    );

    it.each(noValues)(
      'should convert "%s" to false for boolean context value',
      (value) => {
        const ctx: Record<string, any> = { key: true };
        applyOverwritesToContext(ctx, { key: value });
        expect(ctx.key).toBe(false);
      },
    );

    it('should throw on invalid boolean string', () => {
      const ctx: Record<string, any> = { key: true };
      expect(() => applyOverwritesToContext(ctx, { key: 'invalid' })).toThrow();
    });
  });
});
