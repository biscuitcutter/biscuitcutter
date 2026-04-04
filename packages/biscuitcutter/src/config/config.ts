/**
 * Global configuration handling.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { getLogger } from '../utils/log';
import { ConfigDoesNotExistError, InvalidConfigurationError } from '../utils/exceptions';

const logger = getLogger('biscuitcutter.config');

export const USER_CONFIG_PATH = path.join(os.homedir(), '.biscuitcutterrc');

export const BUILTIN_ABBREVIATIONS: Record<string, string> = {
  gh: 'https://github.com/{0}.git',
  gl: 'https://gitlab.com/{0}.git',
  bb: 'https://bitbucket.org/{0}',
};

export interface BiscuitCutterConfig {
  biscuitcutters_dir: string;
  replay_dir: string;
  default_context: Record<string, any>;
  abbreviations: Record<string, string>;
  [key: string]: any;
}

export const DEFAULT_CONFIG: BiscuitCutterConfig = {
  biscuitcutters_dir: path.join(os.homedir(), '.biscuitcutters/'),
  replay_dir: path.join(os.homedir(), '.biscuitcutter_replay/'),
  default_context: {},
  abbreviations: { ...BUILTIN_ABBREVIATIONS },
};

/**
 * Expand both environment variables and user home in the given path.
 */
function expandPath(p: string): string {
  // Expand environment variables like $HOME or ${HOME}
  let expanded = p.replace(/\$\{?(\w+)\}?/g, (_match, varName) => process.env[varName] || '');
  // Expand ~ to home directory
  if (expanded.startsWith('~/') || expanded === '~') {
    expanded = path.join(os.homedir(), expanded.slice(1));
  }
  return expanded;
}

/**
 * Recursively update a dict with the key/value pair of another.
 * Dict values that are objects themselves will be updated, whilst preserving existing keys.
 */
export function mergeConfigs(
  defaultConfig: Record<string, any>,
  overwrite: Record<string, any>,
): Record<string, any> {
  const newConfig = structuredClone(defaultConfig);

  for (const [k, v] of Object.entries(overwrite)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      newConfig[k] = mergeConfigs(newConfig[k] || {}, v);
    } else {
      newConfig[k] = v;
    }
  }

  return newConfig;
}

/**
 * Retrieve the config from the specified path, returning a config dict.
 */
export function getConfig(configPath: string): BiscuitCutterConfig {
  if (!fs.existsSync(configPath)) {
    throw new ConfigDoesNotExistError(
      `Config file ${configPath} does not exist.`,
    );
  }

  logger.debug('config_path is %s', configPath);

  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf-8');
  } catch (e: any) {
    throw new ConfigDoesNotExistError(
      `Unable to read config file ${configPath}: ${e.message}`,
    );
  }

  let yamlDict: any;
  try {
    yamlDict = yaml.parse(content) || {};
  } catch (e: any) {
    throw new InvalidConfigurationError(
      `Unable to parse YAML file ${configPath}.`,
    );
  }

  if (typeof yamlDict !== 'object' || Array.isArray(yamlDict)) {
    throw new InvalidConfigurationError(
      `Top-level element of YAML file ${configPath} should be an object.`,
    );
  }

  const configDict = mergeConfigs(DEFAULT_CONFIG, yamlDict) as BiscuitCutterConfig;

  configDict.replay_dir = expandPath(configDict.replay_dir);
  configDict.biscuitcutters_dir = expandPath(configDict.biscuitcutters_dir);

  return configDict;
}

/**
 * Return the user config as an object.
 *
 * If `defaultConfig` is true, ignore `configFile` and return default values.
 * If `defaultConfig` is an object, merge values with defaults and return them.
 * If a path to a `configFile` is given, load user config from that.
 * Otherwise look up BISCUITCUTTER_CONFIG env var, then the default config path.
 */
export function getUserConfig(
  configFile?: string | null,
  defaultConfig?: boolean | Record<string, any>,
): BiscuitCutterConfig {
  // Merge provided values with defaults
  if (defaultConfig && typeof defaultConfig === 'object') {
    return mergeConfigs(DEFAULT_CONFIG, defaultConfig) as BiscuitCutterConfig;
  }

  // Return defaults
  if (defaultConfig) {
    logger.debug('Force ignoring user config with default_config switch.');
    return { ...DEFAULT_CONFIG };
  }

  // Load the given config file
  if (configFile && configFile !== USER_CONFIG_PATH) {
    logger.debug('Loading custom config from %s.', configFile);
    return getConfig(configFile);
  }

  // Check for environment variable
  const envConfigFile = process.env.BISCUITCUTTER_CONFIG;
  if (envConfigFile) {
    logger.debug('User config not found or not specified. Loading default config.');
    return getConfig(envConfigFile);
  }

  // Load optional user config if it exists
  if (fs.existsSync(USER_CONFIG_PATH)) {
    logger.debug('Loading config from %s.', USER_CONFIG_PATH);
    return getConfig(USER_CONFIG_PATH);
  }

  logger.debug('User config not found. Loading default config.');
  return { ...DEFAULT_CONFIG };
}
