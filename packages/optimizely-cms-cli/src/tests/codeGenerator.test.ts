import { describe, it, expect } from 'vitest';
import {
  generateContentTypeFile,
  generateAllFiles,
  deriveFileName,
  serializeValue,
} from '../service/codeGenerator.js';

describe('deriveFileName', () => {
  it('should append .ts to the key', () => {
    expect(deriveFileName('HeroComponent')).toBe('HeroComponent.ts');
  });

  it('should handle single word keys', () => {
    expect(deriveFileName('Article')).toBe('Article.ts');
  });
});

describe('serializeValue', () => {
  it('should serialize strings with single quotes', () => {
    expect(serializeValue('hello')).toBe("'hello'");
  });

  it('should escape single quotes in strings', () => {
    expect(serializeValue("it's")).toBe("'it\\'s'");
  });

  it('should serialize numbers', () => {
    expect(serializeValue(42)).toBe('42');
  });

  it('should serialize booleans', () => {
    expect(serializeValue(true)).toBe('true');
    expect(serializeValue(false)).toBe('false');
  });

  it('should serialize null', () => {
    expect(serializeValue(null)).toBe('null');
  });

  it('should serialize undefined', () => {
    expect(serializeValue(undefined)).toBe('undefined');
  });

  it('should serialize empty array', () => {
    expect(serializeValue([])).toBe('[]');
  });

  it('should serialize array of strings', () => {
    const result = serializeValue(['a', 'b']);
    expect(result).toBe("['a', 'b']");
  });

  it('should serialize empty object', () => {
    expect(serializeValue({})).toBe('{}');
  });

  it('should serialize simple object', () => {
    const result = serializeValue({ type: 'string' }, 2);
    expect(result).toContain("type: 'string'");
  });

  it('should serialize nested objects with correct indentation', () => {
    const result = serializeValue(
      {
        type: 'contentReference',
        allowedTypes: ['_image'],
      },
      2,
    );
    expect(result).toContain("type: 'contentReference'");
    expect(result).toContain("allowedTypes: ['_image']");
  });

  it('should serialize array of objects', () => {
    const result = serializeValue(
      [
        { value: 'light', displayName: 'Light' },
        { value: 'dark', displayName: 'Dark' },
      ],
      2,
    );
    expect(result).toContain("value: 'light'");
    expect(result).toContain("value: 'dark'");
  });
});

describe('generateContentTypeFile', () => {
  it('should generate valid TypeScript for a simple content type', () => {
    const ct = {
      key: 'HeroComponent',
      displayName: 'Hero Component',
      baseType: '_component',
      properties: {
        heading: { type: 'string' },
      },
    };
    const result = generateContentTypeFile(ct, []);

    expect(result).toContain(
      "import { contentType } from '@optimizely/cms-sdk';",
    );
    expect(result).toContain('export const HeroComponent = contentType({');
    expect(result).toContain("key: 'HeroComponent'");
    expect(result).toContain("displayName: 'Hero Component'");
    expect(result).toContain("baseType: '_component'");
    expect(result).toContain("heading: {\n      type: 'string',\n    }");
    expect(result).toContain('});');
  });

  it('should include display templates in the same file', () => {
    const ct = {
      key: 'Hero',
      baseType: '_component',
      properties: {},
    };
    const templates = [
      {
        key: 'HeroDefault',
        displayName: 'Default',
        contentType: 'Hero',
        isDefault: true,
        settings: {},
      },
    ];
    const result = generateContentTypeFile(ct, templates);

    expect(result).toContain(
      "import { contentType, displayTemplate } from '@optimizely/cms-sdk';",
    );
    expect(result).toContain('export const HeroDefault = displayTemplate({');
    expect(result).toContain("key: 'HeroDefault'");
    expect(result).toContain("contentType: 'Hero'");
    expect(result).toContain('isDefault: true');
  });

  it('should handle content types with compositionBehaviors', () => {
    const ct = {
      key: 'Hero',
      baseType: '_component',
      compositionBehaviors: ['sectionEnabled'],
      properties: {},
    };
    const result = generateContentTypeFile(ct, []);

    expect(result).toContain("compositionBehaviors: ['sectionEnabled']");
  });

  it('should handle content types with enum properties', () => {
    const ct = {
      key: 'Hero',
      baseType: '_component',
      properties: {
        theme: {
          type: 'string',
          enum: [
            { value: 'light', displayName: 'Light Theme' },
            { value: 'dark', displayName: 'Dark Theme' },
          ],
        },
      },
    };
    const result = generateContentTypeFile(ct, []);

    expect(result).toContain("value: 'light'");
    expect(result).toContain("displayName: 'Light Theme'");
  });

  it('should handle content types with no properties', () => {
    const ct = {
      key: 'Empty',
      baseType: '_page',
    };
    const result = generateContentTypeFile(ct, []);

    expect(result).toContain("key: 'Empty'");
    expect(result).toContain("baseType: '_page'");
    // Should not contain a properties field
    expect(result).not.toContain('properties:');
  });

  it('should handle display templates with settings', () => {
    const ct = {
      key: 'Card',
      baseType: '_component',
      properties: {},
    };
    const templates = [
      {
        key: 'CardWide',
        displayName: 'Wide',
        contentType: 'Card',
        isDefault: false,
        settings: {
          width: {
            displayName: 'Width',
            editor: 'select',
            sortOrder: 1,
            choices: {
              full: { displayName: 'Full Width', sortOrder: 1 },
            },
          },
        },
      },
    ];
    const result = generateContentTypeFile(ct, templates);
    expect(result).toContain("displayName: 'Wide'");
    expect(result).toContain("editor: 'select'");
    expect(result).toContain("displayName: 'Full Width'");
  });

  it('should handle mayContainTypes', () => {
    const ct = {
      key: 'Container',
      baseType: '_page',
      mayContainTypes: ['Hero', '_page'],
      properties: {},
    };
    const result = generateContentTypeFile(ct, []);
    expect(result).toContain("mayContainTypes: ['Hero', '_page']");
  });
});

describe('generateAllFiles', () => {
  it('should generate one file per content type', () => {
    const contentTypes = [
      { key: 'Hero', baseType: '_component', properties: {} },
      { key: 'Article', baseType: '_page', properties: {} },
    ];
    const files = generateAllFiles(contentTypes, []);

    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath)).toContain('Hero.ts');
    expect(files.map((f) => f.relativePath)).toContain('Article.ts');
  });

  it('should associate display templates with their content type file', () => {
    const contentTypes = [
      { key: 'Hero', baseType: '_component', properties: {} },
    ];
    const displayTemplates = [
      {
        key: 'HeroDefault',
        contentType: 'Hero',
        displayName: 'Default',
        isDefault: true,
        settings: {},
      },
    ];
    const files = generateAllFiles(contentTypes, displayTemplates);

    expect(files).toHaveLength(1);
    const heroFile = files.find((f) => f.relativePath === 'Hero.ts')!;
    expect(heroFile.content).toContain('HeroDefault');
    expect(heroFile.content).toContain('displayTemplate');
  });

  it('should put orphaned display templates in _templates.ts', () => {
    const contentTypes = [
      { key: 'Hero', baseType: '_component', properties: {} },
    ];
    const displayTemplates = [
      {
        key: 'DefaultRow',
        nodeType: 'row',
        displayName: 'Default Row',
        isDefault: true,
        settings: {},
      },
    ];
    const files = generateAllFiles(contentTypes, displayTemplates);

    const templateFile = files.find(
      (f) => f.relativePath === '_templates.ts',
    );
    expect(templateFile).toBeDefined();
    expect(templateFile!.content).toContain('DefaultRow');
  });

  it('should return empty array for empty input', () => {
    const files = generateAllFiles([], []);
    expect(files).toEqual([]);
  });

  it('should handle multiple display templates for one content type', () => {
    const contentTypes = [
      { key: 'Card', baseType: '_component', properties: {} },
    ];
    const displayTemplates = [
      {
        key: 'CardDefault',
        contentType: 'Card',
        displayName: 'Default',
        isDefault: true,
        settings: {},
      },
      {
        key: 'CardWide',
        contentType: 'Card',
        displayName: 'Wide',
        isDefault: false,
        settings: {},
      },
    ];
    const files = generateAllFiles(contentTypes, displayTemplates);

    expect(files).toHaveLength(1);
    const cardFile = files.find((f) => f.relativePath === 'Card.ts')!;
    expect(cardFile.content).toContain('CardDefault');
    expect(cardFile.content).toContain('CardWide');
  });
});
