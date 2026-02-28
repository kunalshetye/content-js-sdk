// Known API base types (without underscore prefix) that map to SDK types (with prefix)
const API_BASE_TYPES = new Set([
  'page',
  'component',
  'experience',
  'section',
  'image',
  'media',
  'video',
  'folder',
  'element',
]);

const READONLY_FIELDS = new Set([
  'source',
  'created',
  'createdBy',
  'lastModified',
  'lastModifiedBy',
]);

/** Strips readonly API fields from an object */
export function stripReadOnlyFields<T extends Record<string, any>>(obj: T): Omit<T, 'source' | 'created' | 'createdBy' | 'lastModified' | 'lastModifiedBy'> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!READONLY_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result as any;
}

/** Prepends `_` to API base types (e.g. 'page' → '_page') */
export function reverseBaseType(apiBaseType: string): string {
  if (apiBaseType.startsWith('_')) return apiBaseType;
  return `_${apiBaseType}`;
}

/** Reverses a type string in allowedTypes/restrictedTypes — prefixes known base types */
function reverseTypeRef(typeRef: string): string {
  if (typeRef.startsWith('_')) return typeRef;
  if (API_BASE_TYPES.has(typeRef)) return `_${typeRef}`;
  return typeRef;
}

/** Reverse-transforms a single property from API manifest format to SDK format */
export function reverseTransformProperty(property: Record<string, any>): Record<string, any> {
  let result = stripReadOnlyFields({ ...property });

  // Drop synthetic format: 'selectOne' when enum is present
  if (result.format === 'selectOne' && result.enum) {
    const { format: _, ...rest } = result;
    result = rest;
  }

  // Reconstruct link array from LinkCollection format
  if (result.type === 'array' && result.format === 'LinkCollection') {
    const { format: _, ...rest } = result;
    result = { ...rest, items: { type: 'link' } };
  }

  // Prefix base types in allowedTypes
  if (Array.isArray(result.allowedTypes)) {
    result.allowedTypes = result.allowedTypes.map(reverseTypeRef);
  }

  // Prefix base types in restrictedTypes
  if (Array.isArray(result.restrictedTypes)) {
    result.restrictedTypes = result.restrictedTypes.map(reverseTypeRef);
  }

  // Recurse into items for array types
  if (result.type === 'array' && result.items && typeof result.items === 'object') {
    result.items = reverseTransformProperty(result.items);
  }

  return result;
}

/** Reverse-transforms all properties on a content type */
function reverseTransformProperties(
  properties: Record<string, any> | undefined,
): Record<string, any> | undefined {
  if (!properties) return undefined;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(properties)) {
    result[key] = reverseTransformProperty(value);
  }
  return result;
}

/** Reverse-transforms mayContainTypes entries */
function reverseMayContainTypes(types: string[] | undefined): string[] | undefined {
  if (!types) return undefined;
  return types.map(reverseTypeRef);
}

interface ManifestContentType {
  key: string;
  displayName?: string;
  baseType?: string;
  properties?: Record<string, any>;
  compositionBehaviors?: string[];
  mayContainTypes?: string[];
  [key: string]: any;
}

interface ManifestDisplayTemplate {
  key: string;
  displayName?: string;
  contentType?: string;
  baseType?: string;
  nodeType?: string;
  isDefault?: boolean;
  settings?: Record<string, any>;
  [key: string]: any;
}

interface ManifestPropertyGroup {
  key: string;
  displayName?: string;
  sortOrder?: number;
  [key: string]: any;
}

interface Manifest {
  contentTypes?: ManifestContentType[];
  displayTemplates?: ManifestDisplayTemplate[];
  propertyGroups?: ManifestPropertyGroup[];
}

interface MappedContent {
  contentTypes: Record<string, any>[];
  displayTemplates: Record<string, any>[];
  propertyGroups: Record<string, any>[];
}

/** Maps an API manifest to SDK domain objects */
export function mapManifestToContent(manifest: Manifest): MappedContent {
  const contentTypes = (manifest.contentTypes ?? []).map((ct) => {
    const cleaned = stripReadOnlyFields(ct);
    const result: Record<string, any> = {
      key: cleaned.key,
    };

    if (cleaned.displayName !== undefined) result.displayName = cleaned.displayName;
    if (cleaned.baseType !== undefined) result.baseType = reverseBaseType(cleaned.baseType);

    const properties = reverseTransformProperties(cleaned.properties);
    if (properties !== undefined) result.properties = properties;

    if (cleaned.compositionBehaviors) {
      result.compositionBehaviors = cleaned.compositionBehaviors;
    }

    const mayContain = reverseMayContainTypes(cleaned.mayContainTypes);
    if (mayContain) result.mayContainTypes = mayContain;

    return result;
  });

  const displayTemplates = (manifest.displayTemplates ?? []).map((dt) => {
    const cleaned = stripReadOnlyFields(dt);
    const result: Record<string, any> = { key: cleaned.key };

    if (cleaned.displayName !== undefined) result.displayName = cleaned.displayName;
    if (cleaned.contentType !== undefined) result.contentType = cleaned.contentType;
    if (cleaned.baseType !== undefined) result.baseType = cleaned.baseType;
    if (cleaned.nodeType !== undefined) result.nodeType = cleaned.nodeType;
    if (cleaned.isDefault !== undefined) result.isDefault = cleaned.isDefault;
    if (cleaned.settings !== undefined) result.settings = cleaned.settings;

    return result;
  });

  const propertyGroups = (manifest.propertyGroups ?? []).map((pg) => {
    const cleaned = stripReadOnlyFields(pg);
    const result: Record<string, any> = { key: cleaned.key };
    if (cleaned.displayName !== undefined) result.displayName = cleaned.displayName;
    if (cleaned.sortOrder !== undefined) result.sortOrder = cleaned.sortOrder;
    return result;
  });

  return { contentTypes, displayTemplates, propertyGroups };
}
