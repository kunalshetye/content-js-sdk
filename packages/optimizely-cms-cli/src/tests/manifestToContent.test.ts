import { describe, it, expect } from 'vitest';
import {
  mapManifestToContent,
  reverseBaseType,
  reverseTransformProperty,
  stripReadOnlyFields,
} from '../mapper/manifestToContent.js';

describe('reverseBaseType', () => {
  it('should prefix base types with _', () => {
    expect(reverseBaseType('page')).toBe('_page');
    expect(reverseBaseType('component')).toBe('_component');
    expect(reverseBaseType('experience')).toBe('_experience');
    expect(reverseBaseType('section')).toBe('_section');
    expect(reverseBaseType('image')).toBe('_image');
    expect(reverseBaseType('media')).toBe('_media');
    expect(reverseBaseType('video')).toBe('_video');
    expect(reverseBaseType('folder')).toBe('_folder');
    expect(reverseBaseType('element')).toBe('_element');
  });

  it('should pass through already-prefixed types', () => {
    expect(reverseBaseType('_page')).toBe('_page');
    expect(reverseBaseType('_component')).toBe('_component');
  });
});

describe('stripReadOnlyFields', () => {
  it('should remove source, created, createdBy, lastModified, lastModifiedBy', () => {
    const input = {
      key: 'Hero',
      displayName: 'Hero',
      source: 'api',
      created: '2024-01-01',
      createdBy: 'admin',
      lastModified: '2024-06-01',
      lastModifiedBy: 'admin',
    };
    const result = stripReadOnlyFields(input);
    expect(result).toEqual({ key: 'Hero', displayName: 'Hero' });
  });

  it('should return the object unchanged if no readonly fields present', () => {
    const input = { key: 'Hero', displayName: 'Hero' };
    const result = stripReadOnlyFields(input);
    expect(result).toEqual(input);
  });
});

describe('reverseTransformProperty', () => {
  it('should pass through simple property types unchanged', () => {
    const prop = { type: 'string' };
    expect(reverseTransformProperty(prop)).toEqual({ type: 'string' });
  });

  it('should pass through boolean properties', () => {
    const prop = { type: 'boolean', displayName: 'Is Active' };
    expect(reverseTransformProperty(prop)).toEqual({
      type: 'boolean',
      displayName: 'Is Active',
    });
  });

  it('should pass through integer properties with range', () => {
    const prop = { type: 'integer', minimum: 0, maximum: 100 };
    expect(reverseTransformProperty(prop)).toEqual({
      type: 'integer',
      minimum: 0,
      maximum: 100,
    });
  });

  it('should drop format: selectOne when enum is present', () => {
    const prop = {
      type: 'string',
      format: 'selectOne',
      enum: [
        { value: 'light', displayName: 'Light' },
        { value: 'dark', displayName: 'Dark' },
      ],
    };
    const result = reverseTransformProperty(prop);
    expect(result.format).toBeUndefined();
    expect(result.enum).toEqual([
      { value: 'light', displayName: 'Light' },
      { value: 'dark', displayName: 'Dark' },
    ]);
  });

  it('should preserve non-selectOne formats', () => {
    const prop = { type: 'string', format: 'html' };
    const result = reverseTransformProperty(prop);
    expect(result.format).toBe('html');
  });

  it('should reconstruct link array from LinkCollection format', () => {
    const prop = {
      type: 'array',
      format: 'LinkCollection',
    };
    const result = reverseTransformProperty(prop);
    expect(result.type).toBe('array');
    expect(result.items).toEqual({ type: 'link' });
    expect(result.format).toBeUndefined();
  });

  it('should prefix base types in allowedTypes', () => {
    const prop = {
      type: 'contentReference',
      allowedTypes: ['image', 'video'],
    };
    const result = reverseTransformProperty(prop);
    expect(result.allowedTypes).toEqual(['_image', '_video']);
  });

  it('should prefix base types in restrictedTypes', () => {
    const prop = {
      type: 'contentReference',
      restrictedTypes: ['page', 'component'],
    };
    const result = reverseTransformProperty(prop);
    expect(result.restrictedTypes).toEqual(['_page', '_component']);
  });

  it('should not prefix non-base types in allowedTypes', () => {
    const prop = {
      type: 'contentReference',
      allowedTypes: ['HeroComponent', 'image'],
    };
    const result = reverseTransformProperty(prop);
    expect(result.allowedTypes).toEqual(['HeroComponent', '_image']);
  });

  it('should handle component type with string contentType', () => {
    const prop = {
      type: 'component',
      contentType: 'HeroBlock',
    };
    const result = reverseTransformProperty(prop);
    expect(result.type).toBe('component');
    expect(result.contentType).toBe('HeroBlock');
  });

  it('should handle array of components', () => {
    const prop = {
      type: 'array',
      items: {
        type: 'component',
        contentType: 'HeroBlock',
      },
    };
    const result = reverseTransformProperty(prop);
    expect(result.type).toBe('array');
    expect(result.items).toEqual({ type: 'component', contentType: 'HeroBlock' });
  });

  it('should handle array of contentReferences with allowedTypes', () => {
    const prop = {
      type: 'array',
      items: {
        type: 'contentReference',
        allowedTypes: ['image'],
      },
    };
    const result = reverseTransformProperty(prop);
    expect(result.items.allowedTypes).toEqual(['_image']);
  });

  it('should strip readonly fields from properties', () => {
    const prop = {
      type: 'string',
      source: 'api',
      created: '2024-01-01',
    };
    const result = reverseTransformProperty(prop);
    expect(result).toEqual({ type: 'string' });
  });
});

describe('mapManifestToContent', () => {
  it('should transform a basic manifest with one content type', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'HeroComponent',
          displayName: 'Hero Component',
          baseType: 'component',
          source: 'api',
          created: '2024-01-01',
          properties: {
            heading: { type: 'string' },
          },
        },
      ],
      displayTemplates: [],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    expect(result.contentTypes).toHaveLength(1);
    expect(result.contentTypes[0]).toEqual({
      key: 'HeroComponent',
      displayName: 'Hero Component',
      baseType: '_component',
      properties: {
        heading: { type: 'string' },
      },
    });
  });

  it('should handle manifest with display templates', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Hero',
          displayName: 'Hero',
          baseType: 'component',
          properties: {},
        },
      ],
      displayTemplates: [
        {
          key: 'HeroDefault',
          displayName: 'Default',
          contentType: 'Hero',
          isDefault: true,
          settings: {},
          source: 'api',
        },
      ],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    expect(result.displayTemplates).toHaveLength(1);
    expect(result.displayTemplates[0]).toEqual({
      key: 'HeroDefault',
      displayName: 'Default',
      contentType: 'Hero',
      isDefault: true,
      settings: {},
    });
  });

  it('should handle manifest with property groups', () => {
    const manifest = {
      contentTypes: [],
      displayTemplates: [],
      propertyGroups: [
        {
          key: 'Content',
          displayName: 'Content',
          sortOrder: 1,
          source: 'api',
        },
      ],
    };
    const result = mapManifestToContent(manifest);
    expect(result.propertyGroups).toEqual([
      { key: 'Content', displayName: 'Content', sortOrder: 1 },
    ]);
  });

  it('should handle empty manifest', () => {
    const manifest = {
      contentTypes: [],
      displayTemplates: [],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    expect(result.contentTypes).toEqual([]);
    expect(result.displayTemplates).toEqual([]);
    expect(result.propertyGroups).toEqual([]);
  });

  it('should handle content type with no properties', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Empty',
          baseType: 'page',
        },
      ],
      displayTemplates: [],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    expect(result.contentTypes[0].key).toBe('Empty');
    expect(result.contentTypes[0].baseType).toBe('_page');
  });

  it('should handle content type with compositionBehaviors', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Hero',
          baseType: 'component',
          compositionBehaviors: ['sectionEnabled'],
          properties: {},
        },
      ],
      displayTemplates: [],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    expect(result.contentTypes[0].compositionBehaviors).toEqual([
      'sectionEnabled',
    ]);
  });

  it('should handle content type with mayContainTypes', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Container',
          baseType: 'page',
          mayContainTypes: ['Hero', 'page'],
          properties: {},
        },
      ],
      displayTemplates: [],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    expect(result.contentTypes[0].mayContainTypes).toEqual(['Hero', '_page']);
  });

  it('should handle complex property types', () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Article',
          baseType: 'page',
          properties: {
            title: { type: 'string' },
            image: {
              type: 'contentReference',
              allowedTypes: ['image'],
            },
            theme: {
              type: 'string',
              format: 'selectOne',
              enum: [
                { value: 'light', displayName: 'Light' },
                { value: 'dark', displayName: 'Dark' },
              ],
            },
            links: {
              type: 'array',
              format: 'LinkCollection',
            },
          },
        },
      ],
      displayTemplates: [],
      propertyGroups: [],
    };
    const result = mapManifestToContent(manifest);
    const ct = result.contentTypes[0];
    expect(ct.properties.title).toEqual({ type: 'string' });
    expect(ct.properties.image.allowedTypes).toEqual(['_image']);
    expect(ct.properties.theme.enum).toBeDefined();
    expect(ct.properties.theme.format).toBeUndefined();
    expect(ct.properties.links.items).toEqual({ type: 'link' });
    expect(ct.properties.links.format).toBeUndefined();
  });

  it('should handle undefined sections in manifest', () => {
    const manifest = {} as any;
    const result = mapManifestToContent(manifest);
    expect(result.contentTypes).toEqual([]);
    expect(result.displayTemplates).toEqual([]);
    expect(result.propertyGroups).toEqual([]);
  });
});
