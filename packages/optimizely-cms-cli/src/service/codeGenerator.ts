export interface GeneratedFile {
  relativePath: string;
  content: string;
  /** The content type key this file was generated from (if applicable) */
  contentTypeKey?: string;
}

/** Derives the filename from a content type key */
export function deriveFileName(key: string): string {
  return `${key}.ts`;
}

/** Serializes a JS value to TypeScript source code */
export function serializeValue(value: unknown, indent = 0): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';

    // Check if all items are primitives (short inline format)
    const allPrimitive = value.every(
      (v) =>
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean',
    );
    if (allPrimitive) {
      return `[${value.map((v) => serializeValue(v)).join(', ')}]`;
    }

    // Array of objects/complex values
    const items = value.map(
      (v) => `${pad(indent + 2)}${serializeValue(v, indent + 2)},`,
    );
    return `[\n${items.join('\n')}\n${pad(indent)}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    const lines = entries.map(([k, v]) => {
      const key = isValidIdentifier(k) ? k : `'${k}'`;
      return `${pad(indent + 2)}${key}: ${serializeValue(v, indent + 2)},`;
    });
    return `{\n${lines.join('\n')}\n${pad(indent)}}`;
  }

  return String(value);
}

function pad(indent: number): string {
  return ' '.repeat(indent);
}

function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/** Generates a TypeScript file for a content type with its associated display templates */
export function generateContentTypeFile(
  contentType: Record<string, any>,
  displayTemplates: Record<string, any>[],
): string {
  const hasTemplates = displayTemplates.length > 0;
  const imports = hasTemplates
    ? "import { contentType, displayTemplate } from '@optimizely/cms-sdk';"
    : "import { contentType } from '@optimizely/cms-sdk';";

  const lines: string[] = [imports, ''];

  // Generate content type
  lines.push(
    `export const ${contentType.key} = contentType(${serializeContentTypeBody(contentType)});`,
  );

  // Generate display templates
  for (const dt of displayTemplates) {
    lines.push('');
    lines.push(
      `export const ${dt.key} = displayTemplate(${serializeDisplayTemplateBody(dt)});`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

/** Generates a file containing only display templates (for orphaned templates) */
function generateTemplateOnlyFile(
  displayTemplates: Record<string, any>[],
): string {
  const lines: string[] = [
    "import { displayTemplate } from '@optimizely/cms-sdk';",
    '',
  ];

  for (const dt of displayTemplates) {
    lines.push(
      `export const ${dt.key} = displayTemplate(${serializeDisplayTemplateBody(dt)});`,
    );
    lines.push('');
  }

  return lines.join('\n');
}

function serializeContentTypeBody(ct: Record<string, any>): string {
  // Build fields in a specific order for readability
  const fields: string[] = [];
  fields.push(`  key: ${serializeValue(ct.key)},`);
  if (ct.displayName !== undefined)
    fields.push(`  displayName: ${serializeValue(ct.displayName)},`);
  if (ct.baseType !== undefined)
    fields.push(`  baseType: ${serializeValue(ct.baseType)},`);
  if (ct.compositionBehaviors)
    fields.push(
      `  compositionBehaviors: ${serializeValue(ct.compositionBehaviors)},`,
    );
  if (ct.mayContainTypes)
    fields.push(
      `  mayContainTypes: ${serializeValue(ct.mayContainTypes)},`,
    );

  if (ct.properties && Object.keys(ct.properties).length > 0) {
    fields.push(`  properties: ${serializeProperties(ct.properties)},`);
  }

  return `{\n${fields.join('\n')}\n}`;
}

function serializeDisplayTemplateBody(dt: Record<string, any>): string {
  const fields: string[] = [];
  fields.push(`  key: ${serializeValue(dt.key)},`);
  if (dt.displayName !== undefined)
    fields.push(`  displayName: ${serializeValue(dt.displayName)},`);
  if (dt.contentType !== undefined)
    fields.push(`  contentType: ${serializeValue(dt.contentType)},`);
  if (dt.baseType !== undefined)
    fields.push(`  baseType: ${serializeValue(dt.baseType)},`);
  if (dt.nodeType !== undefined)
    fields.push(`  nodeType: ${serializeValue(dt.nodeType)},`);
  if (dt.isDefault !== undefined)
    fields.push(`  isDefault: ${serializeValue(dt.isDefault)},`);
  if (dt.settings !== undefined)
    fields.push(`  settings: ${serializeValue(dt.settings, 2)},`);

  return `{\n${fields.join('\n')}\n}`;
}

function serializeProperties(properties: Record<string, any>): string {
  const entries = Object.entries(properties);
  if (entries.length === 0) return '{}';

  const lines = entries.map(([key, value]) => {
    const propKey = isValidIdentifier(key) ? key : `'${key}'`;
    return `    ${propKey}: ${serializeValue(value, 4)},`;
  });

  return `{\n${lines.join('\n')}\n  }`;
}

/** Generates all TypeScript files from content types and display templates */
export function generateAllFiles(
  contentTypes: Record<string, any>[],
  displayTemplates: Record<string, any>[],
): GeneratedFile[] {
  if (contentTypes.length === 0 && displayTemplates.length === 0) return [];

  // Group display templates by contentType
  const templatesByContentType = new Map<string, Record<string, any>[]>();
  const orphanedTemplates: Record<string, any>[] = [];

  const contentTypeKeys = new Set(contentTypes.map((ct) => ct.key));

  for (const dt of displayTemplates) {
    if (dt.contentType && contentTypeKeys.has(dt.contentType)) {
      const existing = templatesByContentType.get(dt.contentType) ?? [];
      existing.push(dt);
      templatesByContentType.set(dt.contentType, existing);
    } else {
      orphanedTemplates.push(dt);
    }
  }

  const files: GeneratedFile[] = [];

  // One file per content type
  for (const ct of contentTypes) {
    const templates = templatesByContentType.get(ct.key) ?? [];
    files.push({
      relativePath: deriveFileName(ct.key),
      content: generateContentTypeFile(ct, templates),
      contentTypeKey: ct.key,
    });
  }

  // Orphaned templates go into _templates.ts
  if (orphanedTemplates.length > 0) {
    files.push({
      relativePath: '_templates.ts',
      content: generateTemplateOnlyFile(orphanedTemplates),
    });
  }

  return files;
}
