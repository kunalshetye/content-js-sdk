import { describe, it, expect } from 'vitest';
import { mapManifestToContent } from '../mapper/manifestToContent.js';
import { generateAllFiles } from '../service/codeGenerator.js';
import { extractMetaData } from '../service/utils.js';
import { mapContentToManifest } from '../mapper/contentToPackage.js';
import * as esbuild from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolve the CLI package root for esbuild's node resolution
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PACKAGE_ROOT = path.resolve(__dirname, '../..');

/**
 * Round-trip test: manifest JSON → reverse map → generate TS → compile → extract → forward map → compare
 */
async function roundTrip(manifest: any) {
  // Step 1: Reverse map manifest → SDK domain objects
  const { contentTypes, displayTemplates } = mapManifestToContent(manifest);

  // Step 2: Generate TypeScript files
  const files = generateAllFiles(contentTypes, displayTemplates);

  // Step 3: Compile generated TS and extract metadata
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'roundtrip-test-'));

  try {
    const allContentTypes: any[] = [];
    const allDisplayTemplates: any[] = [];

    for (const file of files) {
      const filePath = path.join(tmpDir, file.relativePath);
      await writeFile(filePath, file.content);

      const outPath = path.join(
        tmpDir,
        `${path.basename(file.relativePath, '.ts')}.js`,
      );

      await esbuild.build({
        entryPoints: [filePath],
        bundle: true,
        platform: 'node',
        outfile: outPath,
        nodePaths: [path.join(CLI_PACKAGE_ROOT, 'node_modules')],
        // Simulate npm aliasing: customers install @kunalshetye/cms-sdk as @optimizely/cms-sdk
        alias: { '@optimizely/cms-sdk': '@kunalshetye/cms-sdk' },
      });

      const outUrl = pathToFileURL(outPath).href;
      const mod = await import(outUrl);
      const { contentTypeData, displayTemplateData } = extractMetaData(mod);

      allContentTypes.push(...contentTypeData);
      allDisplayTemplates.push(...displayTemplateData);
    }

    // Step 4: Forward map back to manifest format
    const roundTrippedManifest = {
      contentTypes: mapContentToManifest(allContentTypes),
      displayTemplates: allDisplayTemplates,
    };

    return roundTrippedManifest;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

describe('round-trip: manifest → TS → manifest', () => {
  it('should round-trip a simple component', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'HeroComponent',
          displayName: 'Hero Component',
          baseType: 'component',
          properties: {
            heading: { type: 'string' },
            summary: { type: 'string' },
          },
        },
      ],
      displayTemplates: [],
    };

    const result = await roundTrip(manifest);

    expect(result.contentTypes).toHaveLength(1);
    expect(result.contentTypes[0].key).toBe('HeroComponent');
    expect(result.contentTypes[0].displayName).toBe('Hero Component');
    // Forward map strips the `_` prefix from baseType
    expect(result.contentTypes[0].properties.heading.type).toBe('string');
    expect(result.contentTypes[0].properties.summary.type).toBe('string');
  });

  it('should round-trip a component with compositionBehaviors', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'CardBlock',
          baseType: 'component',
          compositionBehaviors: ['sectionEnabled'],
          properties: {
            title: { type: 'string' },
          },
        },
      ],
      displayTemplates: [],
    };

    const result = await roundTrip(manifest);
    expect(result.contentTypes[0].compositionBehaviors).toEqual([
      'sectionEnabled',
    ]);
  });

  it('should round-trip a content type with contentReference', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Article',
          baseType: 'page',
          properties: {
            image: {
              type: 'contentReference',
              allowedTypes: ['image'],
            },
          },
        },
      ],
      displayTemplates: [],
    };

    const result = await roundTrip(manifest);
    // After reverse: allowedTypes becomes ['_image']
    // After forward: stays as ['_image'] (forward map keeps _ prefixed types)
    expect(result.contentTypes[0].properties.image.allowedTypes).toEqual([
      '_image',
    ]);
  });

  it('should round-trip enum properties', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Hero',
          baseType: 'component',
          properties: {
            theme: {
              type: 'string',
              format: 'selectOne',
              enum: [
                { value: 'light', displayName: 'Light Theme' },
                { value: 'dark', displayName: 'Dark Theme' },
              ],
            },
          },
        },
      ],
      displayTemplates: [],
    };

    const result = await roundTrip(manifest);
    // After round-trip, enum should be preserved and format restored to selectOne
    expect(result.contentTypes[0].properties.theme.enum).toEqual([
      { value: 'light', displayName: 'Light Theme' },
      { value: 'dark', displayName: 'Dark Theme' },
    ]);
    expect(result.contentTypes[0].properties.theme.format).toBe('selectOne');
  });

  it('should round-trip LinkCollection', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Nav',
          baseType: 'component',
          properties: {
            links: {
              type: 'array',
              format: 'LinkCollection',
            },
          },
        },
      ],
      displayTemplates: [],
    };

    const result = await roundTrip(manifest);
    // After round-trip: { type: 'array', items: { type: 'link' } } → forward maps back to LinkCollection
    expect(result.contentTypes[0].properties.links.type).toBe('array');
    expect(result.contentTypes[0].properties.links.format).toBe(
      'LinkCollection',
    );
  });

  it('should round-trip display templates', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Hero',
          baseType: 'component',
          properties: {
            title: { type: 'string' },
          },
        },
      ],
      displayTemplates: [
        {
          key: 'HeroDefault',
          displayName: 'Default',
          contentType: 'Hero',
          isDefault: true,
          settings: {},
        },
      ],
    };

    const result = await roundTrip(manifest);
    expect(result.displayTemplates).toHaveLength(1);
    expect(result.displayTemplates[0].key).toBe('HeroDefault');
    expect(result.displayTemplates[0].contentType).toBe('Hero');
    expect(result.displayTemplates[0].isDefault).toBe(true);
  });

  it('should round-trip multiple content types', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Hero',
          displayName: 'Hero',
          baseType: 'component',
          compositionBehaviors: ['sectionEnabled'],
          properties: {
            heading: { type: 'string' },
            background: {
              type: 'contentReference',
              allowedTypes: ['image'],
            },
          },
        },
        {
          key: 'ArticlePage',
          displayName: 'Article Page',
          baseType: 'page',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
          },
        },
      ],
      displayTemplates: [
        {
          key: 'HeroDefault',
          displayName: 'Default',
          contentType: 'Hero',
          isDefault: true,
          settings: {},
        },
      ],
    };

    const result = await roundTrip(manifest);
    expect(result.contentTypes).toHaveLength(2);
    expect(result.displayTemplates).toHaveLength(1);

    const hero = result.contentTypes.find((ct: any) => ct.key === 'Hero');
    const article = result.contentTypes.find(
      (ct: any) => ct.key === 'ArticlePage',
    );

    expect(hero).toBeDefined();
    expect(hero!.compositionBehaviors).toEqual(['sectionEnabled']);
    expect(article).toBeDefined();
    expect(article!.properties.title.type).toBe('string');
  });

  it('should strip readonly fields during round-trip', async () => {
    const manifest = {
      contentTypes: [
        {
          key: 'Hero',
          baseType: 'component',
          source: 'api',
          created: '2024-01-01',
          lastModified: '2024-06-01',
          properties: {
            title: { type: 'string' },
          },
        },
      ],
      displayTemplates: [],
    };

    const result = await roundTrip(manifest);
    expect(result.contentTypes[0]).not.toHaveProperty('source');
    expect(result.contentTypes[0]).not.toHaveProperty('created');
    expect(result.contentTypes[0]).not.toHaveProperty('lastModified');
  });
});
