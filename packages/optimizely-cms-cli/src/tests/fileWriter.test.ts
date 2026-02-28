import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import {
  writeGeneratedFiles,
  reconcileFiles,
  type GeneratedFile,
  type LocalFileMap,
  type WriteResult,
} from '../service/fileWriter.js';

describe('reconcileFiles', () => {
  it('should mark all files as create when localFileMap is empty', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content: 'content', contentTypeKey: 'Hero' },
      {
        relativePath: 'Article.ts',
        content: 'content',
        contentTypeKey: 'Article',
      },
    ];
    const localMap: LocalFileMap = new Map();

    const ops = reconcileFiles(files, localMap, '/out');
    expect(ops).toHaveLength(2);
    expect(ops[0].targetPath).toBe(path.join('/out', 'Hero.ts'));
    expect(ops[0].operation).toBe('create');
    expect(ops[1].targetPath).toBe(path.join('/out', 'Article.ts'));
    expect(ops[1].operation).toBe('create');
  });

  it('should redirect to existing file path for known content types', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content: 'new content', contentTypeKey: 'Hero' },
    ];
    const localMap: LocalFileMap = new Map([
      ['Hero', '/project/src/components/Hero/Hero.opti.ts'],
    ]);

    const ops = reconcileFiles(files, localMap, '/out');
    expect(ops).toHaveLength(1);
    expect(ops[0].targetPath).toBe(
      '/project/src/components/Hero/Hero.opti.ts',
    );
    expect(ops[0].operation).toBe('update');
  });

  it('should use outputDir for types not in localFileMap', () => {
    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content: 'content', contentTypeKey: 'Hero' },
      {
        relativePath: 'NewType.ts',
        content: 'content',
        contentTypeKey: 'NewType',
      },
    ];
    const localMap: LocalFileMap = new Map([
      ['Hero', '/project/src/components/Hero.ts'],
    ]);

    const ops = reconcileFiles(files, localMap, '/out');
    const heroOp = ops.find((o) => o.contentTypeKey === 'Hero')!;
    const newOp = ops.find((o) => o.contentTypeKey === 'NewType')!;

    expect(heroOp.targetPath).toBe('/project/src/components/Hero.ts');
    expect(heroOp.operation).toBe('update');
    expect(newOp.targetPath).toBe(path.join('/out', 'NewType.ts'));
    expect(newOp.operation).toBe('create');
  });

  it('should handle files without contentTypeKey (e.g. _templates.ts)', () => {
    const files: GeneratedFile[] = [
      { relativePath: '_templates.ts', content: 'templates' },
    ];
    const localMap: LocalFileMap = new Map();

    const ops = reconcileFiles(files, localMap, '/out');
    expect(ops).toHaveLength(1);
    expect(ops[0].targetPath).toBe(path.join('/out', '_templates.ts'));
    expect(ops[0].operation).toBe('create');
  });
});

describe('writeGeneratedFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'filewriter-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should create new files', async () => {
    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content: 'export const Hero = {};' },
    ];
    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files,
      force: true,
    });

    expect(result.created).toEqual([path.join(tmpDir, 'Hero.ts')]);
    expect(result.skipped).toEqual([]);
    expect(result.overwritten).toEqual([]);

    const written = await readFile(path.join(tmpDir, 'Hero.ts'), 'utf-8');
    expect(written).toBe('export const Hero = {};');
  });

  it('should skip identical files', async () => {
    const content = 'export const Hero = {};';
    await writeFile(path.join(tmpDir, 'Hero.ts'), content);

    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content },
    ];
    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files,
      force: false,
    });

    expect(result.skipped).toEqual([path.join(tmpDir, 'Hero.ts')]);
    expect(result.created).toEqual([]);
    expect(result.overwritten).toEqual([]);
  });

  it('should overwrite changed files when force is true', async () => {
    await writeFile(path.join(tmpDir, 'Hero.ts'), 'old content');

    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content: 'new content' },
    ];
    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files,
      force: true,
    });

    expect(result.overwritten).toEqual([path.join(tmpDir, 'Hero.ts')]);
    const written = await readFile(path.join(tmpDir, 'Hero.ts'), 'utf-8');
    expect(written).toBe('new content');
  });

  it('should report what would happen in dry run mode', async () => {
    const files: GeneratedFile[] = [
      { relativePath: 'Hero.ts', content: 'export const Hero = {};' },
    ];
    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files,
      force: false,
      dryRun: true,
    });

    expect(result.created).toEqual([path.join(tmpDir, 'Hero.ts')]);
    // File should NOT be written in dry run
    const exists = await readFile(path.join(tmpDir, 'Hero.ts'), 'utf-8').catch(
      () => null,
    );
    expect(exists).toBeNull();
  });

  it('should create nested directories as needed', async () => {
    const files: GeneratedFile[] = [
      {
        relativePath: 'deep/nested/Hero.ts',
        content: 'export const Hero = {};',
      },
    ];
    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files,
      force: true,
    });

    expect(result.created).toEqual([
      path.join(tmpDir, 'deep/nested/Hero.ts'),
    ]);
    const written = await readFile(
      path.join(tmpDir, 'deep/nested/Hero.ts'),
      'utf-8',
    );
    expect(written).toBe('export const Hero = {};');
  });

  it('should handle reconciled operations with absolute paths', async () => {
    const subDir = path.join(tmpDir, 'existing');
    await mkdir(subDir, { recursive: true });
    await writeFile(path.join(subDir, 'Hero.ts'), 'old content');

    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files: [],
      force: true,
      reconciledOps: [
        {
          targetPath: path.join(subDir, 'Hero.ts'),
          content: 'new content',
          operation: 'update',
          contentTypeKey: 'Hero',
        },
        {
          targetPath: path.join(tmpDir, 'NewType.ts'),
          content: 'brand new',
          operation: 'create',
          contentTypeKey: 'NewType',
        },
      ],
    });

    expect(result.overwritten).toContain(path.join(subDir, 'Hero.ts'));
    expect(result.created).toContain(path.join(tmpDir, 'NewType.ts'));

    const heroContent = await readFile(path.join(subDir, 'Hero.ts'), 'utf-8');
    expect(heroContent).toBe('new content');
    const newContent = await readFile(
      path.join(tmpDir, 'NewType.ts'),
      'utf-8',
    );
    expect(newContent).toBe('brand new');
  });

  it('should skip identical reconciled files', async () => {
    const content = 'same content';
    await writeFile(path.join(tmpDir, 'Hero.ts'), content);

    const result = await writeGeneratedFiles({
      outputDir: tmpDir,
      files: [],
      force: false,
      reconciledOps: [
        {
          targetPath: path.join(tmpDir, 'Hero.ts'),
          content,
          operation: 'update',
          contentTypeKey: 'Hero',
        },
      ],
    });

    expect(result.skipped).toContain(path.join(tmpDir, 'Hero.ts'));
  });
});
