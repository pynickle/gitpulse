import { describe, expect, test } from 'bun:test';

import parseGridTemplateColumnWidths from '../app/utils/parseGridTemplateColumnWidths';

describe('parseGridTemplateColumnWidths', () => {
  test('parses resolved pixel track widths', () => {
    expect(parseGridTemplateColumnWidths('272px 811.5px 352px')).toEqual([272, 811.5, 352]);
  });

  test('ignores surrounding and repeated whitespace', () => {
    expect(parseGridTemplateColumnWidths('  272px   352px ')).toEqual([272, 352]);
  });

  test('keeps track positions for non-length tracks as NaN', () => {
    const widths = parseGridTemplateColumnWidths('272px auto 352px');

    expect(widths).toHaveLength(3);
    expect(widths[0]).toBe(272);
    expect(Number.isNaN(widths[1])).toBe(true);
    expect(widths[2]).toBe(352);
  });

  test('returns an empty array for empty input', () => {
    expect(parseGridTemplateColumnWidths('')).toEqual([]);
    expect(parseGridTemplateColumnWidths('   ')).toEqual([]);
  });
});
