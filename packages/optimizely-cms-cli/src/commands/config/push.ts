import { Args, Flags } from '@oclif/core';
import * as path from 'node:path';
import { BaseCommand } from '../../baseCommand.js';
import { writeFile } from 'node:fs/promises';
import { createApiClient } from '../../service/cmsRestClient.js';
import { withRetry } from '../../utils/retry.js';
import {
  findMetaData,
  readFromPath,
  normalizePropertyGroups,
} from '../../service/utils.js';
import { mapContentToManifest } from '../../mapper/contentToPackage.js';
import { pathToFileURL } from 'node:url';
import chalk from 'chalk';
import { createLogger } from '../../utils/logger.js';
import { createSpinner } from '../../utils/spinner.js';
import { findConfigFile } from '../../utils/configSearch.js';
import { diffManifests, formatDiff } from '../../service/diff.js';
import {
  validateManifest,
  formatValidation,
} from '../../service/validate.js';

export default class ConfigPush extends BaseCommand<typeof ConfigPush> {
  static override args = {
    file: Args.string({
      description: 'configuration file',
    }),
  };
  static override flags = {
    host: Flags.string({ description: 'CMS instance URL' }),
    output: Flags.string({ description: 'if passed, write the manifest JSON' }),
    dryRun: Flags.boolean({
      description:
        'do not send anything to the server. When combined with an existing remote config, shows a diff preview.',
    }),
    force: Flags.boolean({
      description:
        'Force updates the content type even though the changes might result in data loss.',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Enable detailed debug output',
      default: false,
    }),
  };
  static override description =
    'Push content type definitions to the CMS from a configuration file';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> ./custom-config.mjs',
    '<%= config.bin %> <%= command.id %> --force',
    '<%= config.bin %> <%= command.id %> --dryRun',
    '<%= config.bin %> <%= command.id %> --verbose',
  ];

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ConfigPush);
    const logger = createLogger(flags.verbose);
    const totalStart = performance.now();

    // Resolve config file path (4.4 layered search)
    let configFilePath: string;
    if (args.file) {
      configFilePath = path.resolve(process.cwd(), args.file);
    } else {
      const found = await findConfigFile(process.cwd());
      if (!found) {
        this.error(
          'No configuration file found. Provide a path or create optimizely.config.mjs in your project.',
          { exit: 1 },
        );
      }
      configFilePath = found;
    }

    // Show resolved paths (2.5)
    console.log(`Config: ${chalk.cyan(configFilePath)}`);
    logger.debug(`Resolved config path: ${configFilePath}`);

    const configPath = pathToFileURL(configFilePath).href;

    // Load and compile
    const compileStart = performance.now();
    const componentPaths = await readFromPath(configPath, 'components');
    const propertyGroups = await readFromPath(configPath, 'propertyGroups');

    // The pattern is relative to the config file
    const configPathDirectory = pathToFileURL(path.dirname(configFilePath)).href;

    // Extract metadata (contentTypes, displayTemplates) from the component paths
    const { contentTypes, displayTemplates } = await findMetaData(
      componentPaths,
      configPathDirectory,
      logger,
    );

    // Validate and normalize property groups
    const normalizedPropertyGroups = propertyGroups
      ? normalizePropertyGroups(propertyGroups)
      : [];

    const metaData = {
      contentTypes: mapContentToManifest(contentTypes),
      displayTemplates,
      propertyGroups: normalizedPropertyGroups,
    };

    const compileEnd = performance.now();
    logger.debug(
      `Compilation completed in ${((compileEnd - compileStart) / 1000).toFixed(2)}s`,
    );

    // Pre-push validation (4.3)
    const validation = validateManifest(metaData as any);
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      console.log(formatValidation(validation));
    }
    if (validation.errors.length > 0 && !flags.force) {
      this.error(
        'Validation failed. Fix the errors above or use --force to push anyway.',
        { exit: 1 },
      );
    }

    // Push summary (3.4)
    console.log();
    console.log(chalk.bold('Push Summary:'));
    console.log(`  Content Types:      ${metaData.contentTypes.length}`);
    console.log(`  Display Templates:  ${metaData.displayTemplates.length}`);
    console.log(`  Property Groups:    ${metaData.propertyGroups.length}`);
    if (metaData.contentTypes.length > 0) {
      console.log();
      for (const ct of metaData.contentTypes) {
        const base = ct.baseType ? ` (${ct.baseType})` : '';
        console.log(`    → ${ct.key}${base}`);
      }
    }
    console.log();

    const restClient = await createApiClient(flags.host);

    if (flags.output) {
      const outputPath = path.resolve(process.cwd(), flags.output);
      await writeFile(outputPath, JSON.stringify(metaData, null, 2));
      console.log(`Written to ${chalk.cyan(outputPath)}`);
    }

    // Dry run with diff preview (4.1)
    if (flags.dryRun) {
      const diffSpinner = createSpinner('Fetching remote manifest for diff...').start();
      try {
        const remoteResponse = await restClient.GET('/experimental/packages');
        diffSpinner.succeed('Remote manifest fetched');
        const remoteMeta = remoteResponse.data as any;
        const diff = diffManifests(remoteMeta, metaData as any);
        console.log();
        console.log(formatDiff(diff));
      } catch {
        diffSpinner.warn('Could not fetch remote manifest for diff comparison');
      }
      const totalTime = ((performance.now() - totalStart) / 1000).toFixed(2);
      console.log(chalk.gray(`\nDry run completed in ${totalTime}s`));
      return;
    }

    if (flags.force) {
      console.warn(
        `${chalk.yellowBright.bold(
          '--force'
        )} is used! This forces content type updates, which may result in data loss`
      );
    }

    const spinner = createSpinner('Uploading configuration file').start();
    const uploadStart = performance.now();

    // Retry on transient failures (4.2)
    const response = await withRetry(
      () =>
        restClient.POST('/experimental/packages', {
          headers: {
            accept: 'application/json',
            'content-type': 'application/vnd.optimizely.cms.v1.manifest+json',
          },
          body: metaData as any,
          params: {
            query: {
              ignoreDataLossWarnings: flags.force,
            },
          },
        }),
    );

    const uploadEnd = performance.now();

    if (response.error) {
      spinner.fail('Error');

      // Actionable HTTP error messages (2.3)
      const status = (response.error as any).status;
      const title = (response.error as any).title;
      const code = (response.error as any).code;
      const detail = (response.error as any).detail;

      switch (status) {
        case 400:
          console.error(
            chalk.red(
              'The manifest contains invalid data. Check your content type definitions.',
            ),
          );
          if (detail) console.error(chalk.red(detail));
          break;
        case 401:
          console.error(
            chalk.red(
              'Authentication failed. Your token may have expired. Run `login` to verify.',
            ),
          );
          break;
        case 403:
          console.error(
            chalk.red(
              'Insufficient permissions. Check your API client scopes.',
            ),
          );
          break;
        case 404:
          console.error(
            chalk.red(
              'The requested feature "preview3_packages_enabled" is not enabled in your environment. ' +
              'Please contact your system administrator or support team to request that this feature be enabled.',
            ),
          );
          break;
        case 409:
          console.error(
            chalk.red(
              'Conflict detected. Use `--force` to overwrite (may cause data loss).',
            ),
          );
          if (detail) console.error(chalk.red(detail));
          break;
        default:
          if (status >= 500) {
            console.error(
              chalk.red(
                `Server error (${status}). This is likely transient — please retry.`,
              ),
            );
          } else {
            console.error(
              chalk.red(`Error ${status} ${title} (${code})`),
            );
            if (detail) console.error(chalk.red(detail));
          }
      }

      this.exit(1);
    }

    spinner.succeed('Configuration file uploaded');

    if (!response.data) {
      console.error(chalk.red('The server did not respond with any content'));
      this.exit(1);
    }

    const data = response.data;

    // Color-coded response output (2.4)
    if (data.outcomes && data.outcomes.length > 0) {
      console.log(chalk.bold('Outcomes:'));
      for (const r of data.outcomes) {
        console.log(chalk.green(`  ✓ ${r.message}`));
      }
    }

    if (data.warnings && data.warnings.length > 0) {
      console.log(chalk.bold('Warnings:'));
      for (const r of data.warnings) {
        console.log(chalk.yellow(`  ⚠ ${r.message}`));
      }
    }

    if (data.errors && data.errors.length > 0) {
      console.log(chalk.bold('Errors:'));
      for (const r of data.errors) {
        console.log(chalk.red(`  ✗ ${r.message}`));
      }
    }

    // Operation timing (3.5)
    const compileTime = ((compileEnd - compileStart) / 1000).toFixed(2);
    const uploadTime = ((uploadEnd - uploadStart) / 1000).toFixed(2);
    const totalTime = ((performance.now() - totalStart) / 1000).toFixed(2);
    console.log(
      chalk.gray(
        `\nCompiled ${metaData.contentTypes.length} types in ${compileTime}s | Uploaded in ${uploadTime}s | Total: ${totalTime}s`,
      ),
    );
  }
}
