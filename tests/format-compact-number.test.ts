import { describe, expect, test } from 'bun:test';

import formatCompactNumber from '../app/utils/formatCompactNumber';

describe('formatCompactNumber', () => {
  test('formats thousands compactly in English', () => {
    expect(formatCompactNumber(5600, 'en')).toBe('5.6K');
    expect(formatCompactNumber(12345, 'en')).toBe('12.3K');
  });

  test('formats millions compactly in English', () => {
    expect(formatCompactNumber(1_000_000, 'en')).toBe('1M');
    expect(formatCompactNumber(1_200_000, 'en')).toBe('1.2M');
  });

  test('uses Chinese compact units (万) for zh-CN', () => {
    expect(formatCompactNumber(12345, 'zh-CN')).toBe('1.2万');
    expect(formatCompactNumber(1_000_000, 'zh-CN')).toBe('100万');
  });

  test('leaves small counts unabbreviated', () => {
    expect(formatCompactNumber(0, 'en')).toBe('0');
    expect(formatCompactNumber(999, 'en')).toBe('999');
    // zh-CN compact threshold is 万 (10_000), so 5600 stays full digits
    expect(formatCompactNumber(5600, 'zh-CN')).toBe('5600');
  });

  test('returns 0 for non-finite values', () => {
    expect(formatCompactNumber(Number.NaN, 'en')).toBe('0');
    expect(formatCompactNumber(Number.POSITIVE_INFINITY, 'en')).toBe('0');
    expect(formatCompactNumber(Number.NEGATIVE_INFINITY, 'zh-CN')).toBe('0');
  });

  test('accepts maximumFractionDigits override', () => {
    expect(formatCompactNumber(1555, 'en', { maximumFractionDigits: 0 })).toBe('2K');
  });
});
