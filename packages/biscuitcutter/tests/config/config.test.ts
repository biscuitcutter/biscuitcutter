/**
 * Tests for BiscuitCutter config module.
 */
import {
  describe, it, expect,
} from 'vitest';
import * as path from 'path';
import * as os from 'os';
import {
  mergeConfigs,
  getConfig,
  getUserConfig,
  DEFAULT_CONFIG,
} from '../../src/config/config';
import {
  ConfigDoesNotExistError,
  InvalidConfigurationError,
} from '../../src/utils/exceptions';

const FIXTURES_DIR = path.join(__dirname, '../_fixtures/test-config');

describe('mergeConfigs', () => {
  it('should merge two simple objects', () => {
    const defaults = { a: 1, b: 2 };
    const overwrite = { b: 3, c: 4 };
    const result = mergeConfigs(defaults, overwrite);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should deeply merge nested objects', () => {
    const defaults = { a: { x: 1, y: 2 }, b: 'hello' };
    const overwrite = { a: { y: 3, z: 4 } };
    const result = mergeConfigs(defaults, overwrite);
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 'hello' });
  });

  it('should not modify the original objects', () => {
    const defaults = { a: { x: 1 } };
    const overwrite = { a: { y: 2 } };
    mergeConfigs(defaults, overwrite);
    expect(defaults).toEqual({ a: { x: 1 } });
    expect(overwrite).toEqual({ a: { y: 2 } });
  });
});

describe('getConfig', () => {
  it('should load valid config', () => {
    const configPath = path.join(FIXTURES_DIR, 'valid-config.yaml');
    const config = getConfig(configPath);
    expect(config.default_context.full_name).toBe('Firstname Lastname');
    expect(config.default_context.email).toBe('firstname.lastname@gmail.com');
    expect(config.default_context.github_username).toBe('example');
    expect(config.biscuitcutters_dir).toBe('/home/example/some-path-to-templates');
    expect(config.replay_dir).toBe('/home/example/some-path-to-replay-files');
    expect(config.abbreviations.helloworld).toBe(
      'https://github.com/hackebrot/helloworld',
    );
  });

  it('should merge valid partial config with defaults', () => {
    const configPath = path.join(FIXTURES_DIR, 'valid-partial-config.yaml');
    const config = getConfig(configPath);
    expect(config.default_context.full_name).toBe('Firstname Lastname');
    // Should have default values for unset keys
    expect(config.biscuitcutters_dir).toBe(DEFAULT_CONFIG.biscuitcutters_dir);
    expect(config.replay_dir).toBe(DEFAULT_CONFIG.replay_dir);
  });

  it('should throw on non-existent config file', () => {
    expect(() => getConfig('/does/not/exist.yaml')).toThrow(
      ConfigDoesNotExistError,
    );
  });

  it('should throw on invalid YAML config', () => {
    const configPath = path.join(FIXTURES_DIR, 'invalid-config.yaml');
    expect(() => getConfig(configPath)).toThrow(InvalidConfigurationError);
  });

  it('should treat empty config as empty object', () => {
    const configPath = path.join(FIXTURES_DIR, 'empty-config.yaml');
    const config = getConfig(configPath);
    // Should get defaults
    expect(config.biscuitcutters_dir).toBe(DEFAULT_CONFIG.biscuitcutters_dir);
    expect(config.replay_dir).toBe(DEFAULT_CONFIG.replay_dir);
  });

  it('should throw on config with array as top-level', () => {
    const configPath = path.join(FIXTURES_DIR, 'invalid-config-w-array.yaml');
    expect(() => getConfig(configPath)).toThrow(InvalidConfigurationError);
  });

  it('should expand ~ in paths', () => {
    const configPath = path.join(FIXTURES_DIR, 'config-expand-user.yaml');
    const config = getConfig(configPath);
    expect(config.biscuitcutters_dir).toBe(path.join(os.homedir(), 'templates'));
    expect(config.replay_dir).toBe(path.join(os.homedir(), 'replay-files'));
  });

  it('should expand environment variables in paths', () => {
    const originalEnv = process.env.COOKIES;
    process.env.COOKIES = '/tmp/cookies';
    try {
      const configPath = path.join(FIXTURES_DIR, 'config-expand-vars.yaml');
      const config = getConfig(configPath);
      expect(config.biscuitcutters_dir).toBe('/tmp/cookies/templates');
      expect(config.replay_dir).toBe('/tmp/cookies/replay-files');
    } finally {
      if (originalEnv === undefined) {
        delete process.env.COOKIES;
      } else {
        process.env.COOKIES = originalEnv;
      }
    }
  });
});

describe('getUserConfig', () => {
  it('should return defaults when defaultConfig is true', () => {
    const config = getUserConfig(null, true);
    expect(config.biscuitcutters_dir).toBe(DEFAULT_CONFIG.biscuitcutters_dir);
    expect(config.replay_dir).toBe(DEFAULT_CONFIG.replay_dir);
    expect(config.default_context).toEqual({});
  });

  it('should merge when defaultConfig is an object', () => {
    const config = getUserConfig(null, {
      default_context: { foo: 'bar' },
    });
    expect(config.default_context).toEqual({ foo: 'bar' });
    expect(config.biscuitcutters_dir).toBe(DEFAULT_CONFIG.biscuitcutters_dir);
  });

  it('should load config from a given file', () => {
    const configPath = path.join(FIXTURES_DIR, 'valid-config.yaml');
    const config = getUserConfig(configPath);
    expect(config.default_context.full_name).toBe('Firstname Lastname');
  });

  it('should throw if given config file does not exist', () => {
    expect(() => getUserConfig('/does/not/exist.yaml')).toThrow(
      ConfigDoesNotExistError,
    );
  });

  it('should use BISCUITCUTTER_CONFIG env var', () => {
    const configPath = path.join(FIXTURES_DIR, 'valid-config.yaml');
    const originalEnv = process.env.BISCUITCUTTER_CONFIG;
    process.env.BISCUITCUTTER_CONFIG = configPath;
    try {
      const config = getUserConfig();
      expect(config.default_context.full_name).toBe('Firstname Lastname');
    } finally {
      if (originalEnv === undefined) {
        delete process.env.BISCUITCUTTER_CONFIG;
      } else {
        process.env.BISCUITCUTTER_CONFIG = originalEnv;
      }
    }
  });
});
