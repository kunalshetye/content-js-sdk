import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, noopLogger } from '../utils/logger.js';

describe('createLogger', () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should suppress debug output when verbose is false', () => {
    const logger = createLogger(false);
    logger.debug('hidden message');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should show debug output when verbose is true', () => {
    const logger = createLogger(true);
    logger.debug('visible message');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[debug]'),
      'visible message',
    );
  });

  it('should always show info output', () => {
    const logger = createLogger(false);
    logger.info('info message');
    expect(logSpy).toHaveBeenCalledWith('info message');
  });

  it('should always show warn output', () => {
    const logger = createLogger(false);
    logger.warn('warn message');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[warn]'),
      'warn message',
    );
  });

  it('should always show error output', () => {
    const logger = createLogger(false);
    logger.error('error message');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[error]'),
      'error message',
    );
  });
});

describe('noopLogger', () => {
  let logSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should not output anything for any log level', () => {
    noopLogger.debug('a');
    noopLogger.info('b');
    noopLogger.warn('c');
    noopLogger.error('d');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
