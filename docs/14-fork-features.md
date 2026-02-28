# Fork Features Reference

This document is a comprehensive reference of every feature that `@kunalshetye/cms-sdk` adds on top of the official `@optimizely/cms-sdk`. If you're evaluating whether to use this fork, or contributing a new feature, start here.

## At a Glance

| Feature | Status | Details |
|---------|--------|---------|
| Optimizely Forms content types (10 types) | Stable | [Forms Support](#optimizely-forms-support) |
| Automatic Forms feature detection | Stable | [Feature Detection](#automatic-forms-feature-detection) |
| Conditional form fragment inclusion | Stable | [Conditional Fragments](#conditional-form-fragments-in-graphql) |
| Custom version scheme (`@kunalshetye` scope) | Stable | [Version Scheme](#custom-version-scheme) |

## Optimizely Forms Support

The fork ships 10 built-in content type definitions that map to every Optimizely Forms element. Registering them lets the `GraphClient` generate correct GraphQL fragments for forms automatically.

| Key | Description |
|-----|-------------|
| `OptiFormsContainerData` | Top-level form container |
| `OptiFormsTextboxElement` | Single-line text input |
| `OptiFormsTextareaElement` | Multi-line text input |
| `OptiFormsNumberElement` | Numeric input |
| `OptiFormsRangeElement` | Range slider (min/max/increment) |
| `OptiFormsUrlElement` | URL input |
| `OptiFormsChoiceElement` | Radio buttons or checkboxes |
| `OptiFormsSelectionElement` | Dropdown select |
| `OptiFormsSubmitElement` | Submit button |
| `OptiFormsResetElement` | Reset button |

**Quick start:**

```ts
import { initContentTypeRegistry, FormContentTypes } from '@kunalshetye/cms-sdk';

initContentTypeRegistry([
  ...FormContentTypes,
  ...yourAppContentTypes,
]);
```

For the full guide — including rendering patterns, validators, and choice/selection options — see [Working with Optimizely Forms](./13-forms.md).

## Automatic Forms Feature Detection

When the `GraphClient` fetches content metadata, it runs a GraphQL introspection check alongside the existing DAM detection:

```graphql
formsType: __type(name: "OptiFormsContainerData") {
  __typename
}
```

If `OptiFormsContainerData` exists in the Content Graph schema, the SDK sets `formsEnabled = true`. This happens transparently inside `getContentMetaData` — no configuration required.

> [!TIP]
> You can safely register form types even if Forms isn't installed on your CMS instance. The SDK will detect that Forms is absent and skip form fragments entirely.

## Conditional Form Fragments in GraphQL

The `formsEnabled` flag flows through the entire query-building pipeline (`createFragment`, `createExperienceFragments`, `createSingleContentQuery`, `createMultipleContentQuery`).

**When `formsEnabled` is `true`:**
Form types are included in the `_IComponent` fragment spread for experience/composition queries, just like any other component type.

**When `formsEnabled` is `false`:**
Content types whose key starts with `OptiForms` are filtered out of the `_IComponent` fragment. This prevents invalid GraphQL queries on CMS instances where Forms is not installed.

```ts
// Inside createExperienceFragments — the filtering logic
.filter((c) => {
  if (c.baseType === '_component') {
    if (!formsEnabled && c.key.startsWith('OptiForms')) {
      return false;
    }
    // ...
  }
})
```

> [!NOTE]
> This mirrors how the upstream SDK handles DAM assets with the `damEnabled` flag — the same pattern, applied to Forms.

## Custom Version Scheme

| Field | Value |
|-------|-------|
| Package name | `@kunalshetye/cms-sdk` |
| Version format | `{upstream-version}-kunalshetye.{N}` |
| Example | `1.0.0-kunalshetye.2` |
| Base version | Tracks the upstream `@optimizely/cms-sdk` release |

If your codebase imports from `@optimizely/cms-sdk` and you don't want to rename imports, use npm aliasing:

```json
{
  "dependencies": {
    "@optimizely/cms-sdk": "npm:@kunalshetye/cms-sdk@1.0.0-kunalshetye.2"
  }
}
```

For full installation instructions, see [Installation](./1-installation.md).

## Technical Diff Summary

Files changed or added relative to the upstream `episerver/content-js-sdk` repository:

| File | Change | Description |
|------|--------|-------------|
| `src/model/formContentTypes.ts` | Added | 10 Optimizely Forms content type definitions |
| `src/index.ts` | Modified | Exports for all form types and `FormContentTypes` array |
| `src/graph/index.ts` | Modified | `formsType` introspection query; `formsEnabled` flag threading |
| `src/graph/createQuery.ts` | Modified | `formsEnabled` parameter on `createFragment`, `createExperienceFragments`, `createSingleContentQuery`, `createMultipleContentQuery` |
| `src/graph/__test__/createQueryForms.test.ts` | Added | Tests for form fragment generation and `formsEnabled` filtering |
| `docs/13-forms.md` | Added | Full guide for working with Optimizely Forms |
| `docs/14-fork-features.md` | Added | This document |
| `docs/1-installation.md` | Modified | Fork-specific installation notes and aliasing instructions |
| `package.json` | Modified | `@kunalshetye` scope, custom version scheme, publish config |

## Contributing a New Fork Feature

When adding a feature to this fork:

1. **Update the "At a Glance" table** above with the new feature
2. **Add a detailed section** in this document or create a separate doc in `docs/` if the feature warrants its own guide
3. **Update the "Technical Diff Summary"** table with any new or modified files
4. **Add tests** for the new functionality
5. **Update the README** (`packages/optimizely-cms-sdk/README.md`) if the feature affects the quick start or documentation links
