import { describe, it, expect, vi, afterEach } from 'vitest';
import { findConfigFile } from '../utils/configSearch.js';
import * as fs from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}));

describe('findConfigFile', () => {
  const mockAccess = vi.mocked(fs.access);

  afterEach(() => {
    mockAccess.mockReset();
  });

  it('should find optimizely.config.mjs in the start directory', async () => {
    mockAccess.mockImplementation(async (path) => {
      if (String(path).endsWith('optimizely.config.mjs')) return;
      throw new Error('ENOENT');
    });

    const result = await findConfigFile('/project');
    expect(result).toBe('/project/optimizely.config.mjs');
  });

  it('should try .js if .mjs is not found', async () => {
    mockAccess.mockImplementation(async (path) => {
      if (String(path).endsWith('optimizely.config.js')) return;
      throw new Error('ENOENT');
    });

    const result = await findConfigFile('/project');
    expect(result).toBe('/project/optimizely.config.js');
  });

  it('should try .ts if .mjs and .js are not found', async () => {
    mockAccess.mockImplementation(async (path) => {
      if (String(path).endsWith('optimizely.config.ts')) return;
      throw new Error('ENOENT');
    });

    const result = await findConfigFile('/project');
    expect(result).toBe('/project/optimizely.config.ts');
  });

  it('should walk up parent directories', async () => {
    mockAccess.mockImplementation(async (path) => {
      if (path === '/parent/optimizely.config.mjs') return;
      throw new Error('ENOENT');
    });

    const result = await findConfigFile('/parent/child');
    expect(result).toBe('/parent/optimizely.config.mjs');
  });

  it('should return null if no config is found', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const result = await findConfigFile('/project');
    expect(result).toBeNull();
  });
});
