import { Args, Flags } from '@oclif/core';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { BaseCommand } from '../../baseCommand.js';
import { createApiClient } from '../../service/cmsRestClient.js';
import { createSpinner } from '../../utils/spinner.js';

export default class ContentDelete extends BaseCommand<typeof ContentDelete> {
  static override args = {
    key: Args.string({
      description: 'Unique content type key to delete',
      required: true,
    }),
  };
  static override description = 'Delete a content type definition from the CMS';
  static override examples = [
    '<%= config.bin %> <%= command.id %> Article',
    '<%= config.bin %> <%= command.id %> ProductPage --host https://example.com',
    '<%= config.bin %> <%= command.id %> Article --yes',
  ];
  static override flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompts (for CI/CD)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(ContentDelete);

    if (!flags.yes) {
      const answer = await confirm({
        message: `Delete content type "${args.key}"? This cannot be undone.`,
      });
      if (!answer) return;
    }

    const client = await createApiClient(flags.host);
    const spinner = createSpinner(`Deleting "${args.key}"...`).start();

    const r = await client.DELETE('/content/{key}', {
      params: {
        path: {
          key: args.key,
        },
      },
    });

    if (r.response.ok) {
      spinner.succeed(`Content type "${args.key}" deleted successfully.`);
    } else {
      spinner.fail(`Failed to delete "${args.key}".`);
      const error = r.error as any;
      if (error?.detail) {
        console.error(chalk.red(error.detail));
      } else if (error?.title) {
        console.error(chalk.red(`${error.status} ${error.title}`));
      } else {
        console.error(chalk.red('An unexpected error occurred.'));
      }
      this.exit(1);
    }
  }
}
