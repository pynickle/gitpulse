/**
 * Build SVG path data for a GitHub-style contributor commit sparkline.
 * Values are weekly commit counts (oldest → newest).
 */

export interface ContributorSparklinePaths {
  /** Open polyline through each sample. */
  linePath: string;
  /** Closed area under the line (for fill). Empty when all values are zero. */
  areaPath: string;
  /** Pixel points used by the polyline (for tooltips if needed later). */
  points: { x: number; y: number; value: number }[];
  maxValue: number;
}

export interface BuildContributorSparklineOptions {
  width?: number;
  height?: number;
  /** Inset so stroke caps are not clipped. */
  padding?: number;
}

/**
 * Map a series of non-negative numbers into SVG line/area paths.
 * Empty or all-zero series yield empty path strings and a flat baseline.
 */
export default function buildContributorSparkline(
  values: number[],
  options: BuildContributorSparklineOptions = {}
): ContributorSparklinePaths {
  const width = options.width ?? 200;
  const height = options.height ?? 40;
  const padding = options.padding ?? 1;

  const safeValues = values.map((value) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
  );

  if (safeValues.length === 0) {
    return { linePath: '', areaPath: '', points: [], maxValue: 0 };
  }

  const maxValue = Math.max(...safeValues, 0);
  const innerWidth = Math.max(width - padding * 2, 1);
  const innerHeight = Math.max(height - padding * 2, 1);
  const baselineY = padding + innerHeight;

  const points = safeValues.map((value, index) => {
    const x =
      safeValues.length === 1
        ? padding + innerWidth / 2
        : padding + (index / (safeValues.length - 1)) * innerWidth;
    const y = maxValue === 0 ? baselineY : padding + innerHeight - (value / maxValue) * innerHeight;
    return { x, y, value };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
    .join(' ');

  if (maxValue === 0) {
    return { linePath, areaPath: '', points, maxValue: 0 };
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const areaPath = [
    linePath,
    `L${round(last.x)} ${round(baselineY)}`,
    `L${round(first.x)} ${round(baselineY)}`,
    'Z',
  ].join(' ');

  return { linePath, areaPath, points, maxValue };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
