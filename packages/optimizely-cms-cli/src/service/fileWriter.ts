import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import chalk from 'chalk';

export type { GeneratedFile } from './codeGenerator.js';
import type { GeneratedFile } from './codeGenerator.js';

/** Maps content type key → absolute file path where that type currently lives */
export type LocalFileMap = Map<string, string>;

export interface ReconciledOp {
  targetPath: string;
  content: string;
  operation: 'create' | 'update';
  contentTypeKey?: string;
}

export interface WriteResult {
  created: string[];
  overwritten: string[];
  skipped: string[];
}

/**
 * Reconciles generated files with existing local files.
 * - If a content type exists in localFileMap, the update targets the existing path.
 * - Otherwise, the file is created in outputDir.
 */
export function reconcileFiles(
  files: GeneratedFile[],
  localFileMap: LocalFileMap,
  outputDir: string,
): ReconciledOp[] {
  return files.map((file) => {
    const existingPath = file.contentTypeKey
      ? localFileMap.get(file.contentTypeKey)
      : undefined;

    if (existingPath) {
      return {
        targetPath: existingPath,
        content: file.content,
        operation: 'update' as const,
        contentTypeKey: file.contentTypeKey,
      };
    }

    return {
      targetPath: path.join(outputDir, file.relativePath),
      content: file.content,
      operation: 'create' as const,
      contentTypeKey: file.contentTypeKey,
    };
  });
}

export interface WriteOptions {
  outputDir: string;
  files: GeneratedFile[];
  force?: boolean;
  dryRun?: boolean;
  /** Pre-reconciled operations (used in match mode) */
  reconciledOps?: ReconciledOp[];
}

/**
 * Writes generated files to disk with diff/confirm behavior.
 * - New files: write directly
 * - Identical files: skip
 * - Changed files: overwrite if force, otherwise skip (interactive prompt handled by caller)
 */
export async function writeGeneratedFiles(
  options: WriteOptions,
): Promise<WriteResult> {
  const { outputDir, files, force = false, dryRun = false, reconciledOps } = options;

  const result: WriteResult = { created: [], overwritten: [], skipped: [] };

  // Use reconciled ops if provided, otherwise build simple ops from files
  const ops: ReconciledOp[] = reconciledOps ?? files.map((f) => ({
    targetPath: path.join(outputDir, f.relativePath),
    content: f.content,
    operation: 'create' as const,
    contentTypeKey: f.contentTypeKey,
  }));

  for (const op of ops) {
    const existing = await readFile(op.targetPath, 'utf-8').catch(() => null);

    if (existing === null) {
      // New file
      if (!dryRun) {
        await mkdir(path.dirname(op.targetPath), { recursive: true });
        await writeFile(op.targetPath, op.content);
      }
      result.created.push(op.targetPath);
    } else if (existing === op.content) {
      // Identical — skip
      result.skipped.push(op.targetPath);
    } else if (force || dryRun) {
      // Changed — overwrite
      if (!dryRun) {
        await writeFile(op.targetPath, op.content);
      }
      result.overwritten.push(op.targetPath);
    } else {
      // Changed but no force — skip (caller can prompt interactively)
      result.skipped.push(op.targetPath);
    }
  }

  return result;
}

/** Formats a WriteResult for terminal display */
export function formatWriteResult(result: WriteResult): string {
  const lines: string[] = [];

  if (result.created.length > 0) {
    lines.push(chalk.green(`  + Created: ${result.created.length} file(s)`));
    for (const p of result.created) {
      lines.push(chalk.green(`    + ${p}`));
    }
  }

  if (result.overwritten.length > 0) {
    lines.push(chalk.yellow(`  ~ Updated: ${result.overwritten.length} file(s)`));
    for (const p of result.overwritten) {
      lines.push(chalk.yellow(`    ~ ${p}`));
    }
  }

  if (result.skipped.length > 0) {
    lines.push(chalk.gray(`  = Skipped: ${result.skipped.length} file(s)`));
  }

  if (
    result.created.length === 0 &&
    result.overwritten.length === 0 &&
    result.skipped.length === 0
  ) {
    lines.push(chalk.gray('  No files to write.'));
  }

  return lines.join('\n');
}
