import { access } from 'node:fs/promises';
import * as path from 'node:path';

const CONFIG_FILENAMES = [
  'optimizely.config.mjs',
  'optimizely.config.js',
  'optimizely.config.ts',
];

/**
 * Searches for a config file by walking up parent directories,
 * similar to how ESLint and Prettier resolve config.
 * Tries each filename at each directory level before ascending.
 */
export async function findConfigFile(startDir: string): Promise<string | null> {
  let dir = path.resolve(startDir);

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = path.join(dir, filename);
      try {
        await access(candidate);
        return candidate;
      } catch {
        // file doesn't exist, try next
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return null;
}
