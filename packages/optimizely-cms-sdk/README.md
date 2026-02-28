# @kunalshetye/cms-sdk

[![npm version](https://img.shields.io/npm/v/@kunalshetye/cms-sdk)](https://www.npmjs.com/package/@kunalshetye/cms-sdk)

> **Custom fork of [`@optimizely/cms-sdk`](https://www.npmjs.com/package/@optimizely/cms-sdk)**
>
> This package is a community-maintained fork published under the `@kunalshetye` scope. It tracks the official [`episerver/content-js-sdk`](https://github.com/episerver/content-js-sdk) repository and adds features not yet available upstream, such as built-in Optimizely Forms support and forms-availability detection.
>
> The `main` branch stays in sync with upstream. Custom changes live on the `@kunalshetye/content-js-sdk` release branch.

## What's different from the official SDK?

- **Optimizely Forms support** - Built-in content type definitions for all 10 form element types
- **Forms feature detection** - Automatic introspection check that only includes form fragments when Forms is installed on the CMS instance
- **All upstream features** - Everything from the official SDK is included

For a complete reference, see the [Fork Features documentation](../../docs/14-fork-features.md).

## Installation

```bash
npm install @kunalshetye/cms-sdk@1.0.0-kunalshetye.1
```

Or using other package managers:

```bash
# pnpm
pnpm add @kunalshetye/cms-sdk@1.0.0-kunalshetye.1

# yarn
yarn add @kunalshetye/cms-sdk@1.0.0-kunalshetye.1

# bun
bun add @kunalshetye/cms-sdk@1.0.0-kunalshetye.1
```

> [!NOTE]
> All releases from this fork use the `-kunalshetye.N` prerelease suffix (e.g., `1.0.0-kunalshetye.1`, `1.0.0-kunalshetye.2`). The base version (e.g., `1.0.0`) tracks the upstream `@optimizely/cms-sdk` version it's based on.

### Aliasing as `@optimizely/cms-sdk`

If you have an existing codebase that imports from `@optimizely/cms-sdk` and don't want to rename all imports, you can alias this package:

```json
{
  "dependencies": {
    "@optimizely/cms-sdk": "npm:@kunalshetye/cms-sdk@1.0.0-kunalshetye.1"
  }
}
```

This lets you keep `import { ... } from '@optimizely/cms-sdk'` everywhere while using this fork under the hood.

## Quick Start

```typescript
import { GraphClient, initContentTypeRegistry, FormContentTypes } from '@kunalshetye/cms-sdk';

// Register content types (including forms)
initContentTypeRegistry([
  ...FormContentTypes,
  ...yourAppContentTypes,
]);

// Initialize the client
const client = new GraphClient('<YOUR_APP_SINGLE_KEY>');

// Fetch content — form fragments are included automatically if Forms is enabled
const content = await client.getContentByPath('/some-page');
```

## Build Configuration

The `buildConfig()` factory accepts the following options:

| Field | Type | Description |
|---|---|---|
| `components` | `string[]` | Glob patterns to locate content type definition files |
| `propertyGroups` | `PropertyGroupType[]` | Custom property groups for the CMS editor |
| `contentDir` | `string` | Directory for generated content type files from `config pull` (default: `./src/content`) |

## Documentation

For comprehensive guides and documentation, visit the main repository:

### Getting Started

- [Installation](../../docs/1-installation.md) - Set up your development environment
- [Setup](../../docs/2-setup.md) - Configure the SDK and CLI
- [Modelling](../../docs/3-modelling.md) - Define your content types with TypeScript

### Core Features

- [Fetching Content](../../docs/5-fetching.md) - Query and retrieve content in your app
- [Rendering (React)](../../docs/6-rendering-react.md) - Display content in React components
- [Live Preview](../../docs/7-live-preview.md) - Enable real-time content editing

### Advanced Features

- [Experience](../../docs/8-experience.md) - Work with experiences and variations
- [Display Settings](../../docs/9-display-settings.md) - Configure content display options
- [RichText Component (React)](../../docs/10-richtext-component-react.md) - Render rich text content
- [DAM Assets](../../docs/11-dam-assets.md) - Manage digital assets
- [Client Utils](../../docs/12-client-utils.md) - Utility functions and helpers
- [Forms](../../docs/13-forms.md) - Working with Optimizely Forms
- [Fork Features](../../docs/14-fork-features.md) - Complete reference of features unique to this fork

## Keeping in sync with upstream

This fork follows a simple branching strategy:

- **`main`** — Mirrors the official [`episerver/content-js-sdk`](https://github.com/episerver/content-js-sdk) via GitHub's upstream sync. No custom changes here.
- **`@kunalshetye/content-js-sdk`** — Release branch with custom features. Periodically rebased/merged from `main` to pick up upstream changes.

Releases to npm are published exclusively from the `@kunalshetye/content-js-sdk` branch.

## Support

- **Upstream issues** - Report bugs in the official SDK on [GitHub](https://github.com/episerver/content-js-sdk/issues)
- **Fork-specific issues** - For issues related to this fork's custom features (forms support, etc.), open an issue on this repository

## License

Apache License 2.0

---

**Community fork maintained by [@kunalshetye](https://github.com/kunalshetye)** | [Documentation](../../docs/) | [Upstream](https://github.com/episerver/content-js-sdk)
