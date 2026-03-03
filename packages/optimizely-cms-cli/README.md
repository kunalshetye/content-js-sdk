# @kunalshetye/cms-cli

[![npm version](https://img.shields.io/npm/v/@kunalshetye/cms-cli)](https://www.npmjs.com/package/@kunalshetye/cms-cli)

> **Custom fork of [`@optimizely/cms-cli`](https://www.npmjs.com/package/@optimizely/cms-cli)**
>
> This package is a community-maintained fork published under the `@kunalshetye` scope. It tracks the official [`episerver/content-js-sdk`](https://github.com/episerver/content-js-sdk) repository and adds features not yet available upstream.
>
> The `main` branch stays in sync with upstream. Custom changes live on the `@kunalshetye/content-js-sdk` release branch.

## What's different from the official CLI?

- **TypeScript code generation** - `config pull` generates idiomatic TypeScript files from CMS, completing the round-trip workflow
- **Project reconciliation** - Existing projects get in-place updates; new types are scaffolded into `contentDir`
- **All upstream features** - Everything from the official CLI is included

## Features

- **ContentTypes-to-CMS sync** - Push your TypeScript definitions to Optimizely CMS
- **CMS-to-TypeScript pull** - Generate idiomatic TypeScript files from your CMS configuration
- **Code-first workflow** - Define content types in your preferred IDE with IntelliSense
- **Version control** - Manage content types alongside your application code
- **Simple CLI commands** - Intuitive interface for common tasks
- **Seamless integration** - Works perfectly with [@kunalshetye/cms-sdk](https://www.npmjs.com/package/@kunalshetye/cms-sdk)
- **Dry-run with diff preview** - See exactly what will change before pushing (`--dryRun`)
- **Pre-push validation** - Catch errors locally before round-tripping to the API
- **CI/CD ready** - `--yes` flag for non-interactive environments, non-zero exit codes on failure
- **Verbose logging** - Debug issues with `--verbose` for detailed output
- **Retry on transient failures** - Automatic retries with exponential backoff for 429/5xx errors
- **Config file discovery** - Auto-finds `optimizely.config.mjs/.js/.ts` walking up directories

## Installation

Install as a development dependency:

```bash
npm install -D @kunalshetye/cms-cli
```

Or using other package managers:

```bash
# pnpm
pnpm add -D @kunalshetye/cms-cli

# yarn
yarn add -D @kunalshetye/cms-cli
```

### Aliasing as `@optimizely/cms-cli`

If you have an existing codebase that references `@optimizely/cms-cli`, you can alias this package:

```json
{
  "devDependencies": {
    "@optimizely/cms-cli": "npm:@kunalshetye/cms-cli@1.0.0-kunalshetye.4"
  }
}
```

## Quick Start

### 1. Configure your environment

Create a `.env` file in your project root with your CMS credentials:

```env
OPTIMIZELY_CMS_URL=https://your-cms-instance.com
OPTIMIZELY_CMS_CLIENT_ID=your-client-id
OPTIMIZELY_CMS_CLIENT_SECRET=your-client-secret
```

### 2. Define your content types

Create TypeScript definitions for your content models:

```typescript
import { contentType } from '@kunalshetye/cms-sdk';

export const ArticlePage = contentType({
  key: 'Article',
  displayName: 'Article page',
  baseType: '_page',
  properties: {
    title: {
      displayName: 'Title',
      type: 'string',
    },
    subtitle: {
      type: 'string',
      displayName: 'Subtitle',
    },
    body: {
      displayName: 'body ',
      type: 'richText',
    },
  },
});
```

### 3. Sync to CMS

Run the CLI to push your definitions to Optimizely CMS:

```bash
pnpm exec optimizely-cms-cli config push ./optimizely.config.mjs
```

## Commands

### Configuration Management

Sync your TypeScript content type definitions with Optimizely CMS:

```bash
# Push content types to CMS (auto-discovers optimizely.config.mjs/.js/.ts)
optimizely-cms-cli config push

# Push with custom config file
optimizely-cms-cli config push ./custom-config.mjs

# Preview changes without pushing (dry-run with diff)
optimizely-cms-cli config push --dryRun

# Force update (may result in data loss)
optimizely-cms-cli config push --force

# Verbose output for debugging
optimizely-cms-cli config push --verbose

# Use a custom CMS host
optimizely-cms-cli config push --host https://my-instance.cms.optimizely.com

# Pull content types as TypeScript (default)
optimizely-cms-cli config pull

# Pull to a specific output directory
optimizely-cms-cli config pull --output ./src/cms-types

# Preview what would be generated without writing files
optimizely-cms-cli config pull --dryRun

# Overwrite existing files without confirmation
optimizely-cms-cli config pull --force

# Pull as raw JSON (backward compatible)
optimizely-cms-cli config pull --format json --output ./config.json
```

#### `config pull` behavior

By default, `config pull` generates one TypeScript file per content type using the SDK's `contentType()` and `displayTemplate()` factory functions. Display templates are co-located in the same file as their parent content type.

**New project (scaffold mode):** When no `optimizely.config.mjs` is found, all files are generated into the output directory (default: `./src/content`).

**Existing project (match mode):** When `optimizely.config.mjs` exists with `components` glob patterns, the CLI scans your local files to find where each content type already lives. Existing types are updated in-place; new types from the CMS are generated into the `contentDir` directory.

| Flag | Type | Default | Description |
|---|---|---|---|
| `--format` | `ts \| json` | `ts` | Output format |
| `--output` | string | — | Output directory (TS) or file (JSON) |
| `--force` | boolean | `false` | Overwrite without confirmation |
| `--dryRun` | boolean | `false` | Preview changes without writing |

### Authentication

Verify your CMS credentials are correctly configured:

```bash
# Test your credentials from environment variables
optimizely-cms-cli login

# Show detailed authentication output
optimizely-cms-cli login --verbose
```

### Content Type Operations

Manage individual content types:

```bash
# Delete a specific content type (with confirmation prompt)
optimizely-cms-cli content delete ArticlePage

# Delete with custom host
optimizely-cms-cli content delete ProductPage --host https://example.com

# Skip confirmation (for CI/CD)
optimizely-cms-cli content delete ArticlePage --yes
```

### Dangerous Operations

**Use with extreme caution - these commands are destructive:**

```bash
# Delete ALL user-defined content types (interactive confirmation required)
optimizely-cms-cli danger delete-all-content-types

# Skip confirmation prompts (for CI/CD pipelines)
optimizely-cms-cli danger delete-all-content-types --yes
```

### Get Help

```bash
# Show all available commands
optimizely-cms-cli --help

# Show help for a specific command
optimizely-cms-cli config push --help

# Show help for a topic
optimizely-cms-cli config --help
```

## Documentation

For comprehensive guides and best practices:

### Getting Started

- [Installation](https://github.com/kunalshetye/content-js-sdk/blob/npmjs/docs/1-installation.md) - Set up your development environment
- [Setup](https://github.com/kunalshetye/content-js-sdk/blob/npmjs/docs/2-setup.md) - Configure the SDK and CLI
- [Modelling](https://github.com/kunalshetye/content-js-sdk/blob/npmjs/docs/3-modelling.md) - Define your content types with TypeScript

### Workflow Guides

- [Create Content](https://github.com/kunalshetye/content-js-sdk/blob/npmjs/docs/4-create-content.md) - Add content in Optimizely CMS after syncing types
- [Fetching Content](https://github.com/kunalshetye/content-js-sdk/blob/npmjs/docs/5-fetching.md) - Use the SDK to retrieve typed content

## Best Practices

This CLI tool works best when used alongside the [@kunalshetye/cms-sdk](https://www.npmjs.com/package/@kunalshetye/cms-sdk) for a complete type-safe development experience:

```bash
# Install both packages
npm install @kunalshetye/cms-sdk
npm install -D @kunalshetye/cms-cli
```

The typical workflow:

1. Define content types in TypeScript (or pull them from CMS with `config pull`)
2. Use the CLI to sync definitions to CMS with `config push`
3. Create content in Optimizely CMS
4. Fetch and render content with the SDK

For complete setup instructions, see the [main repository README](https://github.com/kunalshetye/content-js-sdk).

- [Changelog](https://github.com/kunalshetye/content-js-sdk/blob/npmjs/CHANGELOG.md) - Release history

## Support

- **Community Slack** - Join the [Optimizely Community Slack](https://optimizely-community.slack.com/archives/C0952JAST5J)
- **GitHub Issues** - Report bugs or request features on [GitHub](https://github.com/kunalshetye/content-js-sdk/issues)

## License

Apache License 2.0

---

**Community fork maintained by [@kunalshetye](https://github.com/kunalshetye)** | [Documentation](https://github.com/kunalshetye/content-js-sdk/tree/npmjs/docs) | [Upstream](https://github.com/episerver/content-js-sdk)
