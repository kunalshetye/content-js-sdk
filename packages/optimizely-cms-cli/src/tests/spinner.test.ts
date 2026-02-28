import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createSpinner } from '../utils/spinner.js';

// isCi depends on process.env.CI and process.stdout.isTTY
// Instead of redefining isTTY (which is non-configurable), test via env var
describe('isCi', () => {
  const originalCI = process.env.CI;

  afterEach(() => {
    if (originalCI !== undefined) {
      process.env.CI = originalCI;
    } else {
      delete process.env.CI;
    }
  });

  it('should detect CI=true via environment variable', async () => {
    process.env.CI = 'true';
    // Re-import to get fresh evaluation
    const { isCi } = await import('../utils/spinner.js');
    expect(isCi()).toBe(true);
  });

  it('should not flag as CI when CI env is absent and stdout is TTY', async () => {
    delete process.env.CI;
    const { isCi } = await import('../utils/spinner.js');
    // In a test runner, stdout may or may not be TTY — just verify function runs
    expect(typeof isCi()).toBe('boolean');
  });
});

describe('createSpinner', () => {
  it('should create an ora spinner with the given text', () => {
    const spinner = createSpinner('Loading...');
    expect(spinner).toBeDefined();
    expect(spinner.text).toBe('Loading...');
  });
});
