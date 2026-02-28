import { describe, it, expect } from 'vitest';
import { validateManifest } from '../service/validate.js';

describe('validateManifest', () => {
  it('should pass for a valid manifest', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Article',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
          },
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should warn about content types with zero properties', () => {
    const manifest = {
      contentTypes: [{ key: 'EmptyType', properties: {} }],
    };
    const result = validateManifest(manifest);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('EmptyType'),
    );
    expect(result.warnings).toContainEqual(
      expect.stringContaining('no properties'),
    );
  });

  it('should error on unknown property types', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Article',
          properties: { title: { type: 'fancyWidget' } },
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.errors).toContainEqual(
      expect.stringContaining('unknown type "fancyWidget"'),
    );
  });

  it('should warn about component references to unknown content types', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Page',
          properties: {
            hero: { type: 'component', contentType: 'NonExistent' },
          },
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('NonExistent'),
    );
  });

  it('should warn about allowedTypes references to unknown types', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Page',
          properties: {
            content: {
              type: 'contentReference',
              allowedTypes: ['UnknownType'],
            },
          },
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.warnings).toContainEqual(
      expect.stringContaining('allowedTypes references unknown type "UnknownType"'),
    );
  });

  it('should not warn about system type references (starting with _)', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Page',
          properties: {
            image: {
              type: 'contentReference',
              allowedTypes: ['_image'],
            },
          },
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should error on mayContainTypes referencing unknown types', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Container',
          properties: { title: { type: 'string' } },
          mayContainTypes: ['NonExistent'],
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.errors).toContainEqual(
      expect.stringContaining('mayContainTypes references unknown type "NonExistent"'),
    );
  });

  it('should allow wildcard * in mayContainTypes', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Container',
          properties: { title: { type: 'string' } },
          mayContainTypes: ['*'],
        },
      ],
    };
    const result = validateManifest(manifest);
    expect(result.errors).toEqual([]);
  });

  it('should handle empty manifest', () => {
    const result = validateManifest({});
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
