# Installation

This page explains how to install the SDK and CLI into your project.

- The SDK is a library with tools to model your content, fetch it and render it
- The CLI is a terminal app to upload your models to the CMS via the CMS REST API

> [!NOTE]
> This is a custom fork of the official Optimizely SDK, published as [`@kunalshetye/cms-sdk`](https://www.npmjs.com/package/@kunalshetye/cms-sdk). It includes all upstream features plus built-in Optimizely Forms support. The installation instructions below use this fork's package name. If you're using the official SDK, replace `@kunalshetye/cms-sdk` with `@optimizely/cms-sdk`.

You can use the CLI directly by running

```sh
npx @optimizely/cms-cli@latest
```

You should see a command list

<details><summary>Alternative installation</summary>

### Install globally

```sh
npm install @optimizely/cms-cli -g
```

You can test that it worked by running:

```sh
optimizely-cms-cli
```

### Install in a project

```sh
npm install @optimizely/cms-cli -D
```

Then use it from the project:

```sh
npx optimizely-cms-cli
```

</details>

## Step 1. Initialize a npm project

We recommend to initialize a Next.js project. Run:

```sh
npx create-next-app@latest
```

And select the following prompts:

- Would you like to use TypeScript: Yes
- Would you like your code inside a `src/` directory? Yes
- Would you like to use App Router? (recommended) Yes

## Step 2. Install the SDK

```sh
npm install @kunalshetye/cms-sdk@1.0.0-kunalshetye.1
```

> [!NOTE]
> All releases from this fork use the `-kunalshetye.N` prerelease suffix (e.g., `1.0.0-kunalshetye.1`, `1.0.0-kunalshetye.2`). The base version tracks the upstream `@optimizely/cms-sdk` version it's based on.

**Aliasing (optional):** If you want to use `@optimizely/cms-sdk` in your imports without renaming everything, add this to your `package.json` instead:

```json
{
  "dependencies": {
    "@optimizely/cms-sdk": "npm:@kunalshetye/cms-sdk@1.0.0-kunalshetye.1"
  }
}
```

## Next steps

Now, you are ready to [set up the CLI](./2-setup.md)
