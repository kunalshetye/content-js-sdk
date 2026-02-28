import { describe, it, expect } from 'vitest';
import { diffManifests, formatDiff } from '../service/diff.js';

describe('diffManifests', () => {
  it('should detect added content types', () => {
    const remote = { contentTypes: [] };
    const local = { contentTypes: [{ key: 'Article' }] };
    const diff = diffManifests(remote, local);
    expect(diff.added).toEqual(['Article']);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it('should detect removed content types', () => {
    const remote = { contentTypes: [{ key: 'Article' }] };
    const local = { contentTypes: [] };
    const diff = diffManifests(remote, local);
    expect(diff.removed).toEqual(['Article']);
    expect(diff.added).toEqual([]);
  });

  it('should detect modified content types', () => {
    const remote = {
      contentTypes: [{ key: 'Article', displayName: 'Old Article' }],
    };
    const local = {
      contentTypes: [{ key: 'Article', displayName: 'New Article' }],
    };
    const diff = diffManifests(remote, local);
    expect(diff.modified).toEqual(['Article']);
    expect(diff.unchanged).toEqual([]);
  });

  it('should detect unchanged content types', () => {
    const ct = { key: 'Article', displayName: 'Article' };
    const remote = { contentTypes: [ct] };
    const local = { contentTypes: [{ ...ct }] };
    const diff = diffManifests(remote, local);
    expect(diff.unchanged).toEqual(['Article']);
    expect(diff.modified).toEqual([]);
  });

  it('should handle undefined remote manifest', () => {
    const local = { contentTypes: [{ key: 'Article' }] };
    const diff = diffManifests(undefined, local);
    expect(diff.added).toEqual(['Article']);
    expect(diff.removed).toEqual([]);
  });

  it('should handle mixed changes', () => {
    const remote = {
      contentTypes: [
        { key: 'Article', displayName: 'Article' },
        { key: 'OldPage', displayName: 'Old' },
        { key: 'Unchanged', displayName: 'Same' },
      ],
    };
    const local = {
      contentTypes: [
        { key: 'Article', displayName: 'Updated Article' },
        { key: 'NewPage', displayName: 'New' },
        { key: 'Unchanged', displayName: 'Same' },
      ],
    };
    const diff = diffManifests(remote, local);
    expect(diff.added).toEqual(['NewPage']);
    expect(diff.removed).toEqual(['OldPage']);
    expect(diff.modified).toEqual(['Article']);
    expect(diff.unchanged).toEqual(['Unchanged']);
  });
});

describe('formatDiff', () => {
  it('should show no changes message for empty diff', () => {
    const result = formatDiff({
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
    });
    expect(result).toContain('No changes detected');
  });

  it('should include all sections for mixed diff', () => {
    const result = formatDiff({
      added: ['NewType'],
      removed: ['OldType'],
      modified: ['ChangedType'],
      unchanged: ['SameType'],
    });
    expect(result).toContain('Added');
    expect(result).toContain('NewType');
    expect(result).toContain('Removed');
    expect(result).toContain('OldType');
    expect(result).toContain('Modified');
    expect(result).toContain('ChangedType');
    expect(result).toContain('Unchanged');
  });
});
