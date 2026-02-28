import chalk from 'chalk';

export interface ManifestDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

interface ContentTypeEntry {
  key: string;
  [prop: string]: unknown;
}

interface Manifest {
  contentTypes?: ContentTypeEntry[];
  displayTemplates?: ContentTypeEntry[];
  propertyGroups?: ContentTypeEntry[];
}

/** Computes a diff summary between a remote and local manifest */
export function diffManifests(
  remote: Manifest | undefined,
  local: Manifest,
): ManifestDiff {
  const remoteKeys = new Map<string, ContentTypeEntry>();
  for (const ct of remote?.contentTypes ?? []) {
    remoteKeys.set(ct.key, ct);
  }

  const localKeys = new Map<string, ContentTypeEntry>();
  for (const ct of local.contentTypes ?? []) {
    localKeys.set(ct.key, ct);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];

  for (const [key, localCt] of localKeys) {
    const remoteCt = remoteKeys.get(key);
    if (!remoteCt) {
      added.push(key);
    } else if (hasChanges(remoteCt, localCt)) {
      modified.push(key);
    } else {
      unchanged.push(key);
    }
  }

  for (const key of remoteKeys.keys()) {
    if (!localKeys.has(key)) {
      removed.push(key);
    }
  }

  return { added, removed, modified, unchanged };
}

/** Shallow comparison of two content type entries */
function hasChanges(a: ContentTypeEntry, b: ContentTypeEntry): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Formats a ManifestDiff for terminal display */
export function formatDiff(diff: ManifestDiff): string {
  const lines: string[] = [];

  lines.push(chalk.bold('Diff Summary:'));

  if (diff.added.length > 0) {
    lines.push(chalk.green(`  + Added (${diff.added.length}):`));
    for (const key of diff.added) {
      lines.push(chalk.green(`    + ${key}`));
    }
  }

  if (diff.removed.length > 0) {
    lines.push(chalk.red(`  - Removed (${diff.removed.length}):`));
    for (const key of diff.removed) {
      lines.push(chalk.red(`    - ${key}`));
    }
  }

  if (diff.modified.length > 0) {
    lines.push(chalk.yellow(`  ~ Modified (${diff.modified.length}):`));
    for (const key of diff.modified) {
      lines.push(chalk.yellow(`    ~ ${key}`));
    }
  }

  if (diff.unchanged.length > 0) {
    lines.push(chalk.gray(`  = Unchanged (${diff.unchanged.length})`));
  }

  if (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.modified.length === 0
  ) {
    lines.push(chalk.gray('  No changes detected.'));
  }

  return lines.join('\n');
}
