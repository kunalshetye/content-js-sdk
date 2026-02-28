import { confirm } from '@inquirer/prompts';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../../baseCommand.js';
import { createApiClient } from '../../service/cmsRestClient.js';
import { createSpinner } from '../../utils/spinner.js';

export default class DangerDeleteAllContentTypes extends BaseCommand<
  typeof DangerDeleteAllContentTypes
> {
  static override args = {};
  static override description =
    '⚠️  [DANGER] Delete ALL user-defined content types from the CMS (excludes system types)';
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --host https://example.com',
    '<%= config.bin %> <%= command.id %> --yes',
  ];
  static override flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompts (for CI/CD)',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(DangerDeleteAllContentTypes);
    const client = await createApiClient(flags.host);

    if (!flags.yes) {
      const answer = await confirm({
        message: 'This will delete all your content types. Are you sure?',
      });

      if (!answer) {
        return;
      }
    }

    const contentTypes = await client
      .GET('/contenttypes')
      .then((r) => r.data?.items);

    const deletedTypes = contentTypes?.filter(
      (t) => t.source !== 'system' && t.source !== 'serverModel'
    );

    if (!deletedTypes) {
      return;
    }

    if (deletedTypes.length === 0) {
      console.log('There are no content types in the CMS');
      return;
    }

    console.log();
    console.log('You will delete all these content types');
    for (const type of deletedTypes) {
      console.log(`- ${type.displayName} (${type.key})`);
    }

    if (!flags.yes) {
      const answer2 = await confirm({
        message: 'Are you sure?',
      });

      if (!answer2) {
        return;
      }
    }

    for (const type of deletedTypes) {
      const spinner = createSpinner(`Deleting ${type.key}...`).start();
      const r = await client.DELETE('/contenttypes/{key}', {
        params: { path: { key: type.key } },
      });

      if (!r.response.ok) {
        spinner.fail(`'${type.key}' cannot be deleted`);
      } else {
        spinner.succeed(`'${type.key}' deleted`);
      }
    }
  }
}
