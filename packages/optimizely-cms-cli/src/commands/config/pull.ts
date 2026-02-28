import { Flags } from '@oclif/core';
import { resolve } from 'node:path';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import { BaseCommand } from '../../baseCommand.js';
import { createApiClient } from '../../service/cmsRestClient.js';
import { createSpinner } from '../../utils/spinner.js';
import { createLogger } from '../../utils/logger.js';
import { findConfigFile } from '../../utils/configSearch.js';
import { mapManifestToContent } from '../../mapper/manifestToContent.js';
import { generateAllFiles } from '../../service/codeGenerator.js';
import {
  writeGeneratedFiles,
  reconcileFiles,
  formatWriteResult,
  type LocalFileMap,
} from '../../service/fileWriter.js';
import {
  findMetaData,
  readFromPath,
  extractMetaData,
} from '../../service/utils.js';

const DEFAULT_CONTENT_DIR = './src/content';

export default class ConfigPull extends BaseCommand<typeof ConfigPull> {
  static override flags = {
    format: Flags.string({
      description: 'Output format',
      options: ['ts', 'json'],
      default: 'ts',
    }),
    output: Flags.string({
      description:
        'Output path — directory for TS format, file for JSON format',
    }),
    force: Flags.boolean({
      description: 'Overwrite files without confirmation',
      default: false,
    }),
    dryRun: Flags.boolean({
      description: 'Preview changes without writing files',
      default: false,
    }),
  };
  static override description =
    'Download content type definitions from CMS. Generates TypeScript files by default, or JSON with --format json.';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --format json --output ./out.json',
    '<%= config.bin %> <%= command.id %> --output ./src/cms-types',
    '<%= config.bin %> <%= command.id %> --dryRun',
    '<%= config.bin %> <%= command.id %> --force',
  ];

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConfigPull);
    const logger = createLogger(flags.verbose);

    // JSON format: backward-compatible path
    if (flags.format === 'json') {
      if (!flags.output) {
        this.error('--output is required when using --format json', {
          exit: 1,
        });
      }
      await this.pullJson(flags.output, flags.host);
      return;
    }

    // TypeScript format: new pull with reconciliation
    await this.pullTypeScript(flags, logger);
  }

  /** Backward-compatible JSON pull */
  private async pullJson(output: string, host?: string): Promise<void> {
    const outputPath = resolve(process.cwd(), output);
    const restClient = await createApiClient(host);

    const spinner = createSpinner('Downloading configuration...').start();
    const response = await restClient
      .GET('/experimental/packages')
      .then((r) => r.data);

    if (!response) {
      spinner.fail('The server did not respond with any content');
      this.exit(1);
    }

    spinner.succeed('Configuration downloaded');
    await writeFile(outputPath, JSON.stringify(response, null, 2));
    console.log(`Written to ${chalk.cyan(outputPath)}`);
  }

  /** TypeScript pull with reconciliation */
  private async pullTypeScript(
    flags: {
      output?: string;
      force: boolean;
      dryRun: boolean;
      host?: string;
      verbose: boolean;
    },
    logger: ReturnType<typeof createLogger>,
  ): Promise<void> {
    const totalStart = performance.now();
    const restClient = await createApiClient(flags.host);

    // 1. Fetch remote manifest
    const spinner = createSpinner('Downloading configuration...').start();
    const response = await restClient
      .GET('/experimental/packages')
      .then((r) => r.data);

    if (!response) {
      spinner.fail('The server did not respond with any content');
      this.exit(1);
    }
    spinner.succeed('Configuration downloaded');

    // 2. Reverse-map manifest → SDK domain objects
    const mapSpinner = createSpinner('Mapping content types...').start();
    const { contentTypes, displayTemplates } = mapManifestToContent(
      response as any,
    );
    mapSpinner.succeed(
      `Mapped ${contentTypes.length} content type(s), ${displayTemplates.length} display template(s)`,
    );

    // 3. Generate TypeScript files
    const files = generateAllFiles(contentTypes, displayTemplates);
    logger.debug(`Generated ${files.length} file(s)`);

    // 4. Resolve output directory and detect project mode
    const configFilePath = await findConfigFile(process.cwd());
    let outputDir: string;
    let localFileMap: LocalFileMap = new Map();
    let isMatchMode = false;

    if (flags.output) {
      // Explicit output always uses scaffold mode
      outputDir = resolve(process.cwd(), flags.output);
    } else if (configFilePath) {
      // Existing project — match mode
      isMatchMode = true;
      outputDir = await this.resolveContentDir(configFilePath);
      localFileMap = await this.buildLocalFileMap(configFilePath, logger);
      logger.debug(
        `Match mode: ${localFileMap.size} existing type(s) found locally`,
      );
    } else {
      // New project — scaffold mode
      outputDir = resolve(process.cwd(), DEFAULT_CONTENT_DIR);
    }

    logger.debug(`Output directory: ${outputDir}`);

    // 5. Reconcile and write
    const reconciledOps = isMatchMode
      ? reconcileFiles(files, localFileMap, outputDir)
      : undefined;

    if (flags.dryRun) {
      console.log(chalk.bold('\nDry Run Preview:'));
    }

    const writeResult = await writeGeneratedFiles({
      outputDir,
      files,
      force: flags.force,
      dryRun: flags.dryRun,
      reconciledOps,
    });

    // 6. Print summary
    console.log();
    console.log(chalk.bold('Pull Summary:'));
    console.log(formatWriteResult(writeResult));

    if (isMatchMode && localFileMap.size > 0) {
      // Report remote types that don't exist locally (new from CMS)
      const newTypes = files.filter(
        (f) => f.contentTypeKey && !localFileMap.has(f.contentTypeKey),
      );
      if (newTypes.length > 0) {
        console.log(
          chalk.cyan(
            `\n  New types from CMS (written to ${outputDir}):`,
          ),
        );
        for (const f of newTypes) {
          console.log(chalk.cyan(`    + ${f.contentTypeKey}`));
        }
      }
    }

    const totalTime = ((performance.now() - totalStart) / 1000).toFixed(2);
    console.log(chalk.gray(`\nCompleted in ${totalTime}s`));
  }

  /** Resolves the output directory from config's contentDir or default */
  private async resolveContentDir(configFilePath: string): Promise<string> {
    const configDir = path.dirname(configFilePath);

    try {
      const configUrl = pathToFileURL(configFilePath).href;
      const contentDir = await readFromPath(configUrl, 'contentDir');
      if (contentDir && typeof contentDir === 'string') {
        return resolve(configDir, contentDir);
      }
    } catch {
      // Config might not have contentDir
    }

    return resolve(configDir, DEFAULT_CONTENT_DIR);
  }

  /** Scans local project files to build contentTypeKey → filePath map */
  private async buildLocalFileMap(
    configFilePath: string,
    logger: ReturnType<typeof createLogger>,
  ): Promise<LocalFileMap> {
    const localFileMap: LocalFileMap = new Map();

    try {
      const configUrl = pathToFileURL(configFilePath).href;
      const componentPaths = await readFromPath(configUrl, 'components');

      if (!Array.isArray(componentPaths) || componentPaths.length === 0) {
        return localFileMap;
      }

      const configDir = pathToFileURL(path.dirname(configFilePath)).href;
      const { contentTypes } = await findMetaData(
        componentPaths,
        configDir,
        logger,
      );

      // findMetaData doesn't track which file each type came from directly,
      // so we use glob to reconstruct the mapping
      const { glob } = await import('glob');
      const includePatterns = componentPaths
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0 && !p.startsWith('!'));
      const excludePatterns = componentPaths
        .filter((p: string) => p.startsWith('!'))
        .map((p: string) => p.substring(1));

      const cwd = path.dirname(configFilePath);
      const allFiles = (
        await Promise.all(
          includePatterns.map((pattern: string) =>
            glob(pattern, {
              cwd,
              dotRelative: true,
              posix: true,
              ignore: excludePatterns,
            }),
          ),
        )
      ).flat();

      const uniqueFiles = [...new Set(allFiles)].sort();

      // Build map by compiling each file and extracting metadata
      const { mkdtemp, rm } = await import('node:fs/promises');
      const { tmpdir } = await import('node:os');
      const { fileURLToPath, pathToFileURL: toFileURL } = await import(
        'node:url'
      );
      const esbuild = await import('esbuild');

      const tmpDir = await mkdtemp(
        path.join(tmpdir(), 'optimizely-cli-map-'),
      );

      try {
        for (const file of uniqueFiles) {
          try {
            const cwdPath = cwd;
            const outPath = path.join(
              tmpDir,
              `${path.basename(file, path.extname(file))}-${Date.now()}.js`,
            );

            await esbuild.build({
              entryPoints: [file],
              absWorkingDir: cwdPath,
              bundle: true,
              platform: 'node',
              outfile: outPath,
            });

            const outUrl = toFileURL(outPath).href;
            const mod = await import(outUrl);
            const { contentTypeData } = extractMetaData(mod);

            const absoluteFilePath = path.resolve(cwd, file);
            for (const ct of contentTypeData) {
              if (!localFileMap.has(ct.key)) {
                localFileMap.set(ct.key, absoluteFilePath);
              }
            }
          } catch {
            // Skip files that fail to compile
            logger.debug(`Could not process ${file} for local mapping`);
          }
        }
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    } catch (err) {
      logger.debug(`Could not build local file map: ${(err as Error).message}`);
    }

    return localFileMap;
  }
}
