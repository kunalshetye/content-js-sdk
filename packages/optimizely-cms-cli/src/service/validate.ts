import chalk from 'chalk';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

interface ContentTypeEntry {
  key: string;
  baseType?: string;
  properties?: Record<string, any>;
  mayContainTypes?: string[];
  [prop: string]: unknown;
}

interface Manifest {
  contentTypes?: ContentTypeEntry[];
  displayTemplates?: any[];
  propertyGroups?: any[];
}

const KNOWN_PROPERTY_TYPES = new Set([
  'string',
  'boolean',
  'integer',
  'float',
  'url',
  'dateTime',
  'content',
  'contentReference',
  'component',
  'array',
  'link',
]);

/** Validates a manifest locally before pushing to the API */
export function validateManifest(manifest: Manifest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const knownKeys = new Set(
    (manifest.contentTypes ?? []).map((ct) => ct.key),
  );

  for (const ct of manifest.contentTypes ?? []) {
    // Warn about content types with zero properties
    if (
      !ct.properties ||
      Object.keys(ct.properties).length === 0
    ) {
      warnings.push(
        `Content type "${ct.key}" has no properties defined.`,
      );
    }

    // Validate property types
    for (const [propName, propDef] of Object.entries(ct.properties ?? {})) {
      if (propDef.type && !KNOWN_PROPERTY_TYPES.has(propDef.type)) {
        errors.push(
          `Content type "${ct.key}", property "${propName}": unknown type "${propDef.type}".`,
        );
      }

      // Validate contentType references in component properties
      if (
        propDef.type === 'component' &&
        typeof propDef.contentType === 'string' &&
        !knownKeys.has(propDef.contentType)
      ) {
        warnings.push(
          `Content type "${ct.key}", property "${propName}": references unknown content type "${propDef.contentType}".`,
        );
      }

      // Validate allowedTypes references
      if (Array.isArray(propDef.allowedTypes)) {
        for (const ref of propDef.allowedTypes) {
          if (
            typeof ref === 'string' &&
            !ref.startsWith('_') &&
            !knownKeys.has(ref)
          ) {
            warnings.push(
              `Content type "${ct.key}", property "${propName}": allowedTypes references unknown type "${ref}".`,
            );
          }
        }
      }

      // Validate restrictedTypes references
      if (Array.isArray(propDef.restrictedTypes)) {
        for (const ref of propDef.restrictedTypes) {
          if (
            typeof ref === 'string' &&
            !ref.startsWith('_') &&
            !knownKeys.has(ref)
          ) {
            warnings.push(
              `Content type "${ct.key}", property "${propName}": restrictedTypes references unknown type "${ref}".`,
            );
          }
        }
      }
    }

    // Validate mayContainTypes references
    if (Array.isArray(ct.mayContainTypes)) {
      for (const ref of ct.mayContainTypes) {
        if (ref !== '*' && !ref.startsWith('_') && !knownKeys.has(ref)) {
          errors.push(
            `Content type "${ct.key}": mayContainTypes references unknown type "${ref}".`,
          );
        }
      }
    }
  }

  return { errors, warnings };
}

/** Formats validation results for display */
export function formatValidation(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push(chalk.red.bold('Validation Errors:'));
    for (const err of result.errors) {
      lines.push(chalk.red(`  ✗ ${err}`));
    }
  }

  if (result.warnings.length > 0) {
    lines.push(chalk.yellow.bold('Validation Warnings:'));
    for (const warn of result.warnings) {
      lines.push(chalk.yellow(`  ⚠ ${warn}`));
    }
  }

  return lines.join('\n');
}
