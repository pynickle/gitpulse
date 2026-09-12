import { describe, expect, test } from 'bun:test';

import formatReleaseAssetSize from '../app/utils/formatReleaseAssetSize';

describe('formatReleaseAssetSize', () => {
  test('returns null for missing or invalid sizes', () => {
    expect(formatReleaseAssetSize(0)).toBeNull();
    expect(formatReleaseAssetSize(-1)).toBeNull();
    expect(formatReleaseAssetSize(Number.NaN)).toBeNull();
    expect(formatReleaseAssetSize(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test('keeps bytes unscaled below 1 KB', () => {
    expect(formatReleaseAssetSize(1)).toBe('1 B');
    expect(formatReleaseAssetSize(512)).toBe('512 B');
    expect(formatReleaseAssetSize(1023)).toBe('1023 B');
  });

  test('uses one decimal below 10 of a scaled unit', () => {
    expect(formatReleaseAssetSize(1024)).toBe('1.0 KB');
    expect(formatReleaseAssetSize(1536)).toBe('1.5 KB');
    expect(formatReleaseAssetSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  test('drops the decimal at 10 and above', () => {
    expect(formatReleaseAssetSize(10 * 1024)).toBe('10 KB');
    expect(formatReleaseAssetSize(12 * 1024 * 1024)).toBe('12 MB');
  });
});
