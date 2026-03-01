/**
 * Utilities for resolving unresolved DAM (Digital Asset Management) assets.
 *
 * When Content Graph returns DAM content references with `url.type === "GRAPH"`,
 * the `item` field may resolve to a generic `Data` type instead of the specific
 * CMP type (e.g. `cmp_PublicImageAsset`). This module detects those cases and
 * builds a secondary query to fetch the actual asset data.
 */

/** Known CMP DAM asset type names */
export const KNOWN_DAM_TYPES = new Set([
  'cmp_PublicImageAsset',
  'cmp_PublicVideoAsset',
  'cmp_PublicRawFileAsset',
]);

/** Fields to select for each DAM type (mirrors DAM_ASSET_FRAGMENTS) */
const DAM_TYPE_FIELDS: Record<string, string> = {
  cmp_PublicImageAsset:
    'Url Title AltText Description MimeType Height Width Renditions { Id Name Url Width Height } FocalPoint { X Y } Tags { Guid Name }',
  cmp_PublicVideoAsset:
    'Url Title AltText Description MimeType Renditions { Id Name Url Width Height } Tags { Guid Name }',
  cmp_PublicRawFileAsset:
    'Url Title Description MimeType Tags { Guid Name }',
};

/** An unresolved DAM content reference found in a response */
export type UnresolvedDamRef = {
  type: string;
  key: string;
  /** Direct reference to the content reference object for in-place mutation */
  ref: Record<string, any>;
};

/**
 * Parse a graph URL into its components.
 * Format: `graph://source/typeName/key`
 *
 * @example parseGraphUrl("graph://cmp/cmp_PublicImageAsset/abc123")
 * // { source: "cmp", type: "cmp_PublicImageAsset", key: "abc123" }
 */
export function parseGraphUrl(
  url: string,
): { source: string; type: string; key: string } | null {
  if (!url || !url.startsWith('graph://')) return null;
  const parts = url.slice('graph://'.length).split('/');
  if (parts.length < 3) return null;
  return { source: parts[0], type: parts[1], key: parts.slice(2).join('/') };
}

/**
 * Check if an object looks like a content reference with an unresolved DAM asset.
 * An unresolved DAM ref has url.type === "GRAPH" and item.__typename is NOT a known DAM type.
 */
function isUnresolvedDamRef(obj: Record<string, any>): boolean {
  const url = obj.url;
  const item = obj.item;
  return (
    url?.type === 'GRAPH' &&
    typeof url?.graph === 'string' &&
    item != null &&
    typeof item.__typename === 'string' &&
    !KNOWN_DAM_TYPES.has(item.__typename)
  );
}

/**
 * Recursively walk a response object to find all unresolved DAM content references.
 */
export function findUnresolvedDamRefs(obj: unknown): UnresolvedDamRef[] {
  const refs: UnresolvedDamRef[] = [];
  walk(obj, refs);
  return refs;
}

function walk(obj: unknown, refs: UnresolvedDamRef[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) walk(item, refs);
    return;
  }

  const record = obj as Record<string, any>;

  if (isUnresolvedDamRef(record)) {
    const parsed = parseGraphUrl(record.url.graph);
    if (parsed && KNOWN_DAM_TYPES.has(parsed.type)) {
      refs.push({ type: parsed.type, key: parsed.key, ref: record });
    }
  }

  for (const key of Object.keys(record)) {
    walk(record[key], refs);
  }
}

/**
 * Build a GraphQL query that resolves unresolved DAM assets by querying
 * each CMP type directly (not through _Content, since CMP types don't implement _IContent).
 *
 * @returns The query string and a map from alias to ref, or null if nothing to resolve.
 */
export function buildDamResolutionQuery(
  refs: UnresolvedDamRef[],
): { query: string; aliasToRef: Map<string, UnresolvedDamRef> } | null {
  if (refs.length === 0) return null;

  const selections: string[] = [];
  const aliasToRef = new Map<string, UnresolvedDamRef>();

  for (let i = 0; i < refs.length; i++) {
    const { type, key } = refs[i];
    const fields = DAM_TYPE_FIELDS[type];
    if (!fields) continue;

    // Validate key format (alphanumeric, hyphens, underscores only)
    if (!/^[\w-]+$/.test(key)) continue;

    const alias = `_dam${i}`;
    // Query the CMP type directly — CMP types do NOT implement _IContent
    // and use `Id` (not `_metadata.key`) as their filter field.
    selections.push(
      `${alias}: ${type}(where: {Id: {eq: "${key}"}}) { items { __typename ${fields} } }`,
    );
    aliasToRef.set(alias, refs[i]);
  }

  if (selections.length === 0) return null;

  const query = `query ResolveDamAssets {\n  ${selections.join('\n  ')}\n}`;
  return { query, aliasToRef };
}

/**
 * Apply resolved DAM asset data back into the original content references.
 * Mutates the ref objects in-place by replacing their `item` with the resolved data.
 */
export function applyDamResolution(
  data: Record<string, { items: Record<string, any>[] }>,
  aliasToRef: Map<string, UnresolvedDamRef>,
): void {
  for (const [alias, ref] of aliasToRef) {
    const items = data[alias]?.items;
    if (!items || items.length === 0) continue;

    const resolved = items[0];
    if (!KNOWN_DAM_TYPES.has(resolved.__typename)) continue;

    ref.ref.item = resolved;
  }
}
