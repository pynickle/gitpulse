import { describe, expect, test } from 'bun:test';

import buildRepoLanguageBreakdown from '../app/utils/buildRepoLanguageBreakdown';
describe('buildRepoLanguageBreakdown', () => {
  test('returns an empty list for missing or empty language maps', () => {
    expect(buildRepoLanguageBreakdown(null)).toEqual([]);
    expect(buildRepoLanguageBreakdown(undefined)).toEqual([]);
    expect(buildRepoLanguageBreakdown({})).toEqual([]);
    expect(buildRepoLanguageBreakdown({ TypeScript: 0, Vue: 0 })).toEqual([]);
  });

  test('sorts by bytes descending and computes percentages that sum to 100', () => {
    const result = buildRepoLanguageBreakdown({
      CSS: 100,
      TypeScript: 700,
      Vue: 200,
    });

    expect(result.map((item) => item.name)).toEqual(['TypeScript', 'Vue', 'CSS']);
    expect(result.map((item) => item.bytes)).toEqual([700, 200, 100]);
    expect(result.map((item) => item.percentage)).toEqual([70, 20, 10]);
    expect(result.reduce((sum, item) => sum + item.percentage, 0)).toBe(100);
  });

  test('ignores non-positive and non-finite byte counts', () => {
    const result = buildRepoLanguageBreakdown({
      TypeScript: 500,
      Vue: -10,
      CSS: Number.NaN,
      HTML: Number.POSITIVE_INFINITY,
      JSON: 500,
    });

    // Equal byte counts break ties alphabetically.
    expect(result.map((item) => item.name)).toEqual(['JSON', 'TypeScript']);
    expect(result.map((item) => item.percentage)).toEqual([50, 50]);
  });

  test('rounds to one decimal place while preserving a 100% total', () => {
    const result = buildRepoLanguageBreakdown({
      TypeScript: 1,
      Vue: 1,
      CSS: 1,
    });

    expect(result.map((item) => item.percentage)).toEqual([33.4, 33.3, 33.3]);
    // Compare in tenths to avoid IEEE float noise on 33.3 + 33.3 + 33.4.
    expect(result.reduce((sum, item) => sum + Math.round(item.percentage * 10), 0)).toBe(1000);
  });

  test('attaches language colors via getColor', () => {
    const result = buildRepoLanguageBreakdown(
      { TypeScript: 100 },
      {
        getColor: (name) => (name === 'TypeScript' ? '#3178c6' : '#ccc'),
      }
    );

    expect(result).toEqual([
      {
        name: 'TypeScript',
        bytes: 100,
        percentage: 100,
        color: '#3178c6',
      },
    ]);
  });
});
