import { describe, expect, test } from 'bun:test';

import buildContributorSparkline from '../app/utils/buildContributorSparkline';

describe('buildContributorSparkline', () => {
  test('returns empty paths for an empty series', () => {
    const paths = buildContributorSparkline([]);
    expect(paths.linePath).toBe('');
    expect(paths.areaPath).toBe('');
    expect(paths.maxValue).toBe(0);
  });

  test('builds a flat baseline when all values are zero', () => {
    const paths = buildContributorSparkline([0, 0, 0], { width: 100, height: 40, padding: 0 });
    expect(paths.maxValue).toBe(0);
    expect(paths.areaPath).toBe('');
    expect(paths.linePath.startsWith('M')).toBe(true);
    expect(paths.points).toHaveLength(3);
    expect(paths.points.every((point) => point.y === 40)).toBe(true);
  });

  test('builds line and area paths for active weeks', () => {
    const paths = buildContributorSparkline([0, 4, 2], { width: 100, height: 40, padding: 0 });
    expect(paths.maxValue).toBe(4);
    expect(paths.linePath).toContain('M');
    expect(paths.linePath).toContain('L');
    expect(paths.areaPath.endsWith('Z')).toBe(true);
    expect(paths.points[1]!.y).toBeLessThan(paths.points[0]!.y);
  });

  test('handles a single sample without dividing by zero', () => {
    const paths = buildContributorSparkline([3], { width: 100, height: 40, padding: 0 });
    expect(paths.points).toHaveLength(1);
    expect(paths.points[0]!.x).toBe(50);
    expect(paths.linePath).toMatch(/^M/);
  });
});
