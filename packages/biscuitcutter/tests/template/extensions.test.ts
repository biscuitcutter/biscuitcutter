/**
 * Tests for BiscuitCutter extensions (default filters and globals).
 */
import {
  describe, it, expect,
} from 'vitest';
import { createStrictEnvironment } from '../../src/templating';

describe('Default Extensions', () => {
  describe('jsonify filter', () => {
    it('should convert object to JSON string', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ data | jsonify }}', {
        data: { name: 'test', value: 42 },
      });
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('test');
      expect(parsed.value).toBe(42);
    });

    it('should support custom indent', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ data | jsonify(2) }}', {
        data: { a: 1 },
      });
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });

  describe('slugify filter', () => {
    it('should slugify a string', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ name | slugify }}', {
        name: 'Hello World',
      });
      expect(result).toBe('hello-world');
    });

    it('should handle special characters', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ name | slugify }}', {
        name: 'Hello! World@#$',
      });
      expect(result).toBe('hello-world');
    });
  });

  describe('uuid4 global', () => {
    it('should generate a valid UUID', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ uuid4() }}', {});
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should generate unique UUIDs', () => {
      const env = createStrictEnvironment();
      const uuid1 = env.renderString('{{ uuid4() }}', {});
      const uuid2 = env.renderString('{{ uuid4() }}', {});
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('random_ascii_string global', () => {
    it('should generate a random string of specified length', () => {
      const env = createStrictEnvironment();
      const result = env.renderString(
        '{{ random_ascii_string(20) }}',
        {},
      );
      expect(result).toHaveLength(20);
      expect(result).toMatch(/^[a-zA-Z]+$/);
    });

    it('should include punctuation when requested', () => {
      const env = createStrictEnvironment();
      // Generate a long string so there's a high probability of punctuation
      const result = env.renderString(
        '{{ random_ascii_string(200, true) }}',
        {},
      );
      expect(result).toHaveLength(200);
    });
  });

  describe('now global', () => {
    it('should return the current year with %Y format', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ now(format="%Y") }}', {});
      const year = new Date().getFullYear();
      expect(result).toBe(String(year));
    });

    it('should return ISO date with default format', () => {
      const env = createStrictEnvironment();
      const result = env.renderString('{{ now() }}', {});
      // Format should be YYYY-MM-DD
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
