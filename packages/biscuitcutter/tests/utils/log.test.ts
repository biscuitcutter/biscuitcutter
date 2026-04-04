/**
 * Tests for BiscuitCutter log module.
 */
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLogger, configureLogger } from '../../src/utils/log';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset to INFO level
    configureLogger('INFO');
  });

  it('should log info messages when level is INFO', () => {
    configureLogger('INFO');
    const logger = getLogger('test');
    logger.info('Hello %s', 'world');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Hello world'),
    );
  });

  it('should not log debug messages when level is INFO', () => {
    configureLogger('INFO');
    const logger = getLogger('test');
    logger.debug('This should not appear');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log debug messages when level is DEBUG', () => {
    configureLogger('DEBUG');
    const logger = getLogger('test');
    logger.debug('Debug message');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Debug message'),
    );
  });

  it('should log error messages', () => {
    configureLogger('INFO');
    const logger = getLogger('test');
    logger.error('Error occurred');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error occurred'),
    );
  });

  it('should log warning messages', () => {
    configureLogger('INFO');
    const logger = getLogger('test');
    logger.warn('Warning message');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning message'),
    );
  });

  it('should include logger name in debug mode', () => {
    configureLogger('DEBUG');
    const logger = getLogger('my.module');
    logger.debug('test message');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('my.module'),
    );
  });

  it('should write to debug file when configured', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biscuitcutter-log-test-'));
    const debugFile = path.join(tmpDir, 'debug.log');

    try {
      configureLogger('DEBUG', debugFile);
      const logger = getLogger('test');
      logger.debug('File debug message');

      // Give time for the stream to flush
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      const content = fs.readFileSync(debugFile, 'utf-8');
      expect(content).toContain('File debug message');
    } finally {
      configureLogger('INFO');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
