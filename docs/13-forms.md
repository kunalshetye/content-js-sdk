# Working with Optimizely Forms

When Optimizely Forms is installed on your CMS instance, the SDK provides built-in content type definitions for all form elements. These definitions let the `GraphClient` generate the correct GraphQL fragments automatically — no manual schema work required.

> [!NOTE]
> Form content types are only included in GraphQL queries when the SDK detects that Forms is installed on your CMS instance. If Forms isn't enabled, the SDK skips form fragments entirely to avoid query errors. This detection happens automatically — you don't need to configure anything.

The SDK gives you:

- `FormContentTypes` - Convenience array of all 10 form content type definitions
- Individual exports for each form type (e.g., `OptiFormsTextboxElementContentType`)
- Automatic feature detection — form fragments are only included when Forms is available

## Registering Form Types

Add form content types to your content type registry so the SDK can generate GraphQL fragments for them. Use the `FormContentTypes` convenience array to register all 10 types at once:

```ts
import { initContentTypeRegistry, FormContentTypes } from '@optimizely/cms-sdk';

// Register your app's content types alongside the built-in form types
initContentTypeRegistry([
  ...FormContentTypes,
  ...yourAppContentTypes,
]);
```

You can also import individual form types if you only need specific ones:

```ts
import {
  OptiFormsContainerDataContentType,
  OptiFormsTextboxElementContentType,
  OptiFormsSubmitElementContentType,
} from '@optimizely/cms-sdk';

initContentTypeRegistry([
  OptiFormsContainerDataContentType,
  OptiFormsTextboxElementContentType,
  OptiFormsSubmitElementContentType,
  ...yourAppContentTypes,
]);
```

## Available Form Types

### Form Container

| Type | Key | Description |
|------|-----|-------------|
| `OptiFormsContainerDataContentType` | `OptiFormsContainerData` | The top-level form container that holds all form elements |

**Properties:** `Title`, `Description`, `ShowSummaryMessageAfterSubmission`, `SubmitConfirmationMessage`, `ResetConfirmationMessage`, `SubmitUrl`

### Input Elements

| Type | Key | Description |
|------|-----|-------------|
| `OptiFormsTextboxElementContentType` | `OptiFormsTextboxElement` | Single-line text input |
| `OptiFormsTextareaElementContentType` | `OptiFormsTextareaElement` | Multi-line text input |
| `OptiFormsNumberElementContentType` | `OptiFormsNumberElement` | Numeric input |
| `OptiFormsRangeElementContentType` | `OptiFormsRangeElement` | Range slider with min/max/increment |
| `OptiFormsUrlElementContentType` | `OptiFormsUrlElement` | URL input |

### Selection Elements

| Type | Key | Description |
|------|-----|-------------|
| `OptiFormsChoiceElementContentType` | `OptiFormsChoiceElement` | Radio buttons or checkboxes |
| `OptiFormsSelectionElementContentType` | `OptiFormsSelectionElement` | Dropdown select |

### Action Elements

| Type | Key | Description |
|------|-----|-------------|
| `OptiFormsSubmitElementContentType` | `OptiFormsSubmitElement` | Submit button |
| `OptiFormsResetElementContentType` | `OptiFormsResetElement` | Reset button |

## How Feature Detection Works

The SDK uses GraphQL introspection to check whether Forms is installed before including form fragments in queries. This works the same way as [DAM asset detection](./11-dam-assets.md).

When the `GraphClient` fetches content metadata, it runs an introspection check:

```graphql
formsType: __type(name: "OptiFormsContainerData") {
  __typename
}
```

If `OptiFormsContainerData` exists in the schema, the SDK sets `formsEnabled = true` and includes form type fragments in the `_IComponent` spread for experience/composition queries. If the type doesn't exist, form fragments are silently omitted.

This means you can safely register form types in your content type registry even if Forms isn't installed — the SDK won't generate invalid queries.

## Forms in Compositions

All form types use `baseType: '_component'` with `compositionBehaviors: ['elementEnabled']`. This means they participate in the Visual Builder's composition system and appear inside `_IComponent` fragments when querying experience content.

When the SDK builds a query for an experience type, form elements are included alongside your other component types in the composition tree:

```graphql
fragment _IComponent on _IComponent {
  __typename
  ...YourCustomComponent
  ...OptiFormsTextboxElement
  ...OptiFormsSubmitElement
  # ... other registered component types
}
```

Each form element's fragment includes all its properties, so you get the full field data (labels, placeholders, validators, options) in the query response.

## Rendering Form Components

The SDK handles content type definitions and GraphQL query generation. Rendering is up to your frontend framework. Here's the general pattern:

1. **Register form types** in your content type registry
2. **Fetch content** using the `GraphClient` — form data comes back automatically in composition responses
3. **Route form elements** to your rendering components based on `__typename`

```tsx
// Example: routing form elements to rendering components
function FormElementRouter({ element }) {
  switch (element.__typename) {
    case 'OptiFormsTextboxElement':
      return <TextboxField data={element} />;
    case 'OptiFormsTextareaElement':
      return <TextareaField data={element} />;
    case 'OptiFormsChoiceElement':
      return <ChoiceField data={element} />;
    case 'OptiFormsSelectionElement':
      return <SelectionField data={element} />;
    case 'OptiFormsNumberElement':
      return <NumberField data={element} />;
    case 'OptiFormsRangeElement':
      return <RangeField data={element} />;
    case 'OptiFormsUrlElement':
      return <UrlField data={element} />;
    case 'OptiFormsSubmitElement':
      return <SubmitButton data={element} />;
    case 'OptiFormsResetElement':
      return <ResetButton data={element} />;
    default:
      return null;
  }
}
```

Each element will have its properties available on the `data` object — for example, a textbox element will have `Label`, `Placeholder`, `Tooltip`, `PredefinedValue`, `Validators`, and `AutoComplete`.

## Working with Validators

Several form element types include a `Validators` property of type `json`. This property contains the validation rules configured by the editor in the CMS. The structure is determined by Optimizely Forms and typically includes rules like required, pattern matching, and length constraints.

```tsx
function TextboxField({ data }) {
  const validators = data.Validators ? JSON.parse(data.Validators) : [];

  return (
    <div>
      <label>{data.Label}</label>
      <input
        type="text"
        placeholder={data.Placeholder}
        defaultValue={data.PredefinedValue}
        autoComplete={data.AutoComplete}
        title={data.Tooltip}
      />
    </div>
  );
}
```

## Working with Choice and Selection Options

The `OptiFormsChoiceElement` and `OptiFormsSelectionElement` types include an `Options` property of type `json` that contains the available choices configured by the editor. Both types also have an `AllowMultiSelect` boolean property.

```tsx
function ChoiceField({ data }) {
  const options = data.Options ? JSON.parse(data.Options) : [];
  const inputType = data.AllowMultiSelect ? 'checkbox' : 'radio';

  return (
    <fieldset>
      <legend>{data.Label}</legend>
      {options.map((option, i) => (
        <label key={i}>
          <input type={inputType} name={data.Label} value={option.value} />
          {option.caption}
        </label>
      ))}
    </fieldset>
  );
}
```
