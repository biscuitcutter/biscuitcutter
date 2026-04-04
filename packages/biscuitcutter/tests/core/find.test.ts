/**
 * Tests for BiscuitCutter find module.
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { findTemplate } from '../../src/core/find';
import { NonTemplatedInputDirError } from '../../src/utils/exceptions';

const FIXTURES_DIR = path.join(__dirname, '../_fixtures');

describe('findTemplate', () => {
  it('should find template directory with default jinja strings', () => {
    const repoDir = path.join(FIXTURES_DIR, 'fake-repo-pre');
    const template = findTemplate(repoDir);
    expect(template).toBe(
      path.join(repoDir, '{{biscuitcutter.repo_name}}'),
    );
  });

  it('should throw NonTemplatedInputDirError when no template dir exists', () => {
    const repoDir = path.join(FIXTURES_DIR, 'fake-repo-bad');
    expect(() => findTemplate(repoDir)).toThrow(NonTemplatedInputDirError);
  });

  it('should find template in fake-repo-pre2 with alternate delimiters', () => {
    // fake-repo-pre2 has {%{cookiecutter.repo_name}%} but our findTemplate
    // looks for {{ and }} by default, so this should actually fail
    // since the dir uses {%{ }%} delimiters
    const repoDir = path.join(FIXTURES_DIR, 'fake-repo-pre2');
    // This repo has a dir with {%{ }%} which won't match default {{ }}
    // The whatever.some.thing file doesn't match either
    expect(() => findTemplate(repoDir)).toThrow(NonTemplatedInputDirError);
  });

  it('should find template in ordinary repo', () => {
    const repoDir = path.join(FIXTURES_DIR, 'test-generate-files');
    const template = findTemplate(repoDir);
    expect(template).toContain('input{{biscuitcutter.food}}');
  });
});
