import { describe, it, expect } from 'vitest';
import {
  parseGraphUrl,
  findUnresolvedDamRefs,
  buildDamResolutionQuery,
  applyDamResolution,
} from '../damResolver.js';

describe('parseGraphUrl()', () => {
  it('should parse a valid graph URL', () => {
    const result = parseGraphUrl(
      'graph://cmp/cmp_PublicImageAsset/2607188814f311f1a9d7fa741b9f5025',
    );
    expect(result).toEqual({
      source: 'cmp',
      type: 'cmp_PublicImageAsset',
      key: '2607188814f311f1a9d7fa741b9f5025',
    });
  });

  it('should parse a graph URL with hyphens in key', () => {
    const result = parseGraphUrl(
      'graph://cmp/cmp_PublicVideoAsset/abc-123-def',
    );
    expect(result).toEqual({
      source: 'cmp',
      type: 'cmp_PublicVideoAsset',
      key: 'abc-123-def',
    });
  });

  it('should return null for empty string', () => {
    expect(parseGraphUrl('')).toBeNull();
  });

  it('should return null for non-graph URL', () => {
    expect(parseGraphUrl('https://example.com')).toBeNull();
  });

  it('should return null for incomplete graph URL', () => {
    expect(parseGraphUrl('graph://cmp')).toBeNull();
    expect(parseGraphUrl('graph://cmp/type')).toBeNull();
  });

  it('should parse CMS graph URL', () => {
    const result = parseGraphUrl(
      'graph://cms/ImageMedia/60ade08d2c1f42648ef3b91f05fab948',
    );
    expect(result).toEqual({
      source: 'cms',
      type: 'ImageMedia',
      key: '60ade08d2c1f42648ef3b91f05fab948',
    });
  });
});

describe('findUnresolvedDamRefs()', () => {
  it('should find unresolved DAM references in a flat object', () => {
    const data = {
      Image: {
        key: 'abc123',
        url: {
          type: 'GRAPH',
          default: null,
          graph: 'graph://cmp/cmp_PublicImageAsset/abc123',
        },
        item: { __typename: 'Data' },
      },
    };

    const refs = findUnresolvedDamRefs(data);
    expect(refs).toHaveLength(1);
    expect(refs[0].type).toBe('cmp_PublicImageAsset');
    expect(refs[0].key).toBe('abc123');
  });

  it('should find refs nested inside composition structure', () => {
    const data = {
      composition: {
        nodes: [
          {
            nodes: [
              {
                component: {
                  __typename: 'Image',
                  Image: {
                    key: 'key1',
                    url: {
                      type: 'GRAPH',
                      default: null,
                      graph: 'graph://cmp/cmp_PublicImageAsset/key1',
                    },
                    item: { __typename: 'Data' },
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const refs = findUnresolvedDamRefs(data);
    expect(refs).toHaveLength(1);
    expect(refs[0].key).toBe('key1');
  });

  it('should find multiple unresolved refs', () => {
    const data = {
      img1: {
        key: 'key1',
        url: {
          type: 'GRAPH',
          default: null,
          graph: 'graph://cmp/cmp_PublicImageAsset/key1',
        },
        item: { __typename: 'Data' },
      },
      img2: {
        key: 'key2',
        url: {
          type: 'GRAPH',
          default: null,
          graph: 'graph://cmp/cmp_PublicVideoAsset/key2',
        },
        item: { __typename: 'Data' },
      },
    };

    const refs = findUnresolvedDamRefs(data);
    expect(refs).toHaveLength(2);
  });

  it('should skip already-resolved DAM references', () => {
    const data = {
      Image: {
        key: 'abc123',
        url: {
          type: 'GRAPH',
          default: null,
          graph: 'graph://cmp/cmp_PublicImageAsset/abc123',
        },
        item: {
          __typename: 'cmp_PublicImageAsset',
          Url: 'https://assets.example.com/image.jpg',
        },
      },
    };

    const refs = findUnresolvedDamRefs(data);
    expect(refs).toHaveLength(0);
  });

  it('should skip CMS content references (HIERARCHICAL type)', () => {
    const data = {
      Image: {
        key: 'abc123',
        url: {
          type: 'HIERARCHICAL',
          default: 'https://example.com/image.jpg',
          graph: 'graph://cms/ImageMedia/abc123',
        },
        item: null,
      },
    };

    const refs = findUnresolvedDamRefs(data);
    expect(refs).toHaveLength(0);
  });

  it('should skip non-DAM graph types (cms)', () => {
    const data = {
      ref: {
        key: 'abc123',
        url: {
          type: 'GRAPH',
          default: null,
          graph: 'graph://cms/ImageMedia/abc123',
        },
        item: { __typename: 'Data' },
      },
    };

    const refs = findUnresolvedDamRefs(data);
    // ImageMedia is not a known DAM type
    expect(refs).toHaveLength(0);
  });

  it('should return empty array for null/undefined input', () => {
    expect(findUnresolvedDamRefs(null)).toHaveLength(0);
    expect(findUnresolvedDamRefs(undefined)).toHaveLength(0);
  });

  it('should handle arrays of items', () => {
    const data = [
      {
        Image: {
          key: 'key1',
          url: {
            type: 'GRAPH',
            default: null,
            graph: 'graph://cmp/cmp_PublicImageAsset/key1',
          },
          item: { __typename: 'Data' },
        },
      },
      {
        Image: {
          key: 'key2',
          url: {
            type: 'GRAPH',
            default: null,
            graph: 'graph://cmp/cmp_PublicImageAsset/key2',
          },
          item: { __typename: 'Data' },
        },
      },
    ];

    const refs = findUnresolvedDamRefs(data);
    expect(refs).toHaveLength(2);
  });
});

describe('buildDamResolutionQuery()', () => {
  it('should return null for empty refs', () => {
    expect(buildDamResolutionQuery([])).toBeNull();
  });

  it('should build query using CMP type directly (not _Content)', () => {
    const ref = {
      key: 'abc123',
      url: {
        type: 'GRAPH',
        default: null,
        graph: 'graph://cmp/cmp_PublicImageAsset/abc123',
      },
      item: { __typename: 'Data' },
    };

    const result = buildDamResolutionQuery([
      { type: 'cmp_PublicImageAsset', key: 'abc123', ref },
    ]);

    expect(result).not.toBeNull();
    expect(result!.query).toContain('_dam0: cmp_PublicImageAsset(');
    // CMP types use `Id` filter (not `_metadata.key`)
    expect(result!.query).toContain('Id: {eq: "abc123"}');
    expect(result!.query).not.toContain('_metadata');
    expect(result!.query).toContain('Url');
    expect(result!.query).toContain('AltText');
    expect(result!.query).toContain('Renditions');
    // Must NOT use _Content (CMP types don't implement _IContent)
    expect(result!.query).not.toContain('_Content');
  });

  it('should build query for multiple assets of different types', () => {
    const ref1 = { item: { __typename: 'Data' } } as any;
    const ref2 = { item: { __typename: 'Data' } } as any;

    const result = buildDamResolutionQuery([
      { type: 'cmp_PublicImageAsset', key: 'key1', ref: ref1 },
      { type: 'cmp_PublicVideoAsset', key: 'key2', ref: ref2 },
    ]);

    expect(result).not.toBeNull();
    expect(result!.query).toContain('_dam0: cmp_PublicImageAsset(');
    expect(result!.query).toContain('_dam1: cmp_PublicVideoAsset(');
    // Must NOT use _Content
    expect(result!.query).not.toContain('_Content');
  });
});

describe('applyDamResolution()', () => {
  it('should merge resolved asset data into the content reference', () => {
    const ref = {
      key: 'abc123',
      url: {
        type: 'GRAPH',
        default: null,
        graph: 'graph://cmp/cmp_PublicImageAsset/abc123',
      },
      item: { __typename: 'Data' },
    };

    const aliasToRef = new Map([
      [
        '_dam0',
        { type: 'cmp_PublicImageAsset', key: 'abc123', ref },
      ],
    ]);

    const resolvedData = {
      _dam0: {
        items: [
          {
            __typename: 'cmp_PublicImageAsset',
            Url: 'https://assets.example.com/image.jpg',
            Title: 'Test Image',
            AltText: 'A test image',
            Renditions: [
              {
                Id: 'thumb',
                Name: 'Thumbnail',
                Url: 'https://assets.example.com/thumb.jpg',
                Width: 100,
                Height: 100,
              },
            ],
          },
        ],
      },
    };

    applyDamResolution(resolvedData, aliasToRef);

    const resolved = ref.item as Record<string, any>;
    expect(resolved.__typename).toBe('cmp_PublicImageAsset');
    expect(resolved.Url).toBe('https://assets.example.com/image.jpg');
    expect(resolved.AltText).toBe('A test image');
    expect(resolved.Renditions).toHaveLength(1);
  });

  it('should not modify ref when resolution returns empty items', () => {
    const ref = {
      key: 'abc123',
      url: { type: 'GRAPH', default: null, graph: 'graph://cmp/cmp_PublicImageAsset/abc123' },
      item: { __typename: 'Data' },
    };

    const aliasToRef = new Map([
      ['_dam0', { type: 'cmp_PublicImageAsset', key: 'abc123', ref }],
    ]);

    applyDamResolution({ _dam0: { items: [] } }, aliasToRef);

    expect(ref.item.__typename).toBe('Data');
  });

  it('should not modify ref when resolved type is not a known DAM type', () => {
    const ref = {
      key: 'abc123',
      url: { type: 'GRAPH', default: null, graph: 'graph://cmp/cmp_PublicImageAsset/abc123' },
      item: { __typename: 'Data' },
    };

    const aliasToRef = new Map([
      ['_dam0', { type: 'cmp_PublicImageAsset', key: 'abc123', ref }],
    ]);

    applyDamResolution(
      { _dam0: { items: [{ __typename: 'Data' }] } },
      aliasToRef,
    );

    expect(ref.item.__typename).toBe('Data');
  });
});
