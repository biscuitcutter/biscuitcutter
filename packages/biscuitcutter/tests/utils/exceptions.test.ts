/**
 * Tests for BiscuitCutter exception classes.
 */
import { describe, it, expect } from 'vitest';
import {
  BiscuitCutterError,
  NonTemplatedInputDirError,
  ConfigDoesNotExistError,
  InvalidConfigurationError,
  UndefinedVariableInTemplateError,
  FailedHookError,
  OutputDirExistsError,
  EmptyDirNameError,
  RepositoryNotFoundError,
  ContextDecodingError,
  UnknownExtensionError,
  InvalidModeError,
} from '../../src/utils/exceptions';

describe('Exceptions', () => {
  it('all custom errors should extend BiscuitCutterError', () => {
    const errors = [
      new NonTemplatedInputDirError('test'),
      new ConfigDoesNotExistError('test'),
      new InvalidConfigurationError('test'),
      new FailedHookError('test'),
      new OutputDirExistsError('test'),
      new EmptyDirNameError('test'),
      new RepositoryNotFoundError('test'),
      new ContextDecodingError('test'),
      new UnknownExtensionError('test'),
      new InvalidModeError('test'),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(BiscuitCutterError);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('UndefinedVariableInTemplateError should format string correctly', () => {
    const undefinedVarError = new UndefinedVariableInTemplateError(
      'Beautiful is better than ugly',
      new Error('Errors should never pass silently'),
      { biscuitcutter: { foo: 'bar' } },
    );

    const expectedStr = 'Beautiful is better than ugly. '
      + 'Error message: Errors should never pass silently. '
      + 'Context: {"biscuitcutter":{"foo":"bar"}}';

    expect(undefinedVarError.toString()).toBe(expectedStr);
  });

  it('UndefinedVariableInTemplateError should store error and context', () => {
    const innerError = new Error('inner');
    const context = { biscuitcutter: { key: 'val' } };
    const err = new UndefinedVariableInTemplateError('msg', innerError, context);

    expect(err.message).toBe('msg');
    expect(err.error).toBe(innerError);
    expect(err.context).toBe(context);
    expect(err.name).toBe('UndefinedVariableInTemplateError');
  });

  it('BiscuitCutterError has correct name', () => {
    const err = new BiscuitCutterError('test');
    expect(err.name).toBe('BiscuitCutterError');
    expect(err.message).toBe('test');
  });
});
