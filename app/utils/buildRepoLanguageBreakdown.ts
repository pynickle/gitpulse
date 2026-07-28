/**
 * Turn GitHub's language-bytes map into a sorted percentage breakdown
 * suitable for the repo detail language bar.
 */

export interface RepoLanguageShare {
  name: string;
  bytes: number;
  /** Percentage of total bytes, rounded to one decimal, summing to 100 when non-empty. */
  percentage: number;
  color: string;
}

export type RepoLanguageBytesMap = Record<string, number>;

const DEFAULT_COLOR = '#cccccc';

function isPositiveFiniteBytes(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Largest-remainder method so one-decimal percentages always sum to 100.
 * Avoids the classic "33.3 + 33.3 + 33.3 = 99.9" drift.
 */
function allocatePercentages(weights: number[], total: number): number[] {
  if (weights.length === 0 || total <= 0) return [];

  const exact = weights.map((weight) => (weight / total) * 1000);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = 1000 - floors.reduce((sum, value) => sum + value, 0);

  const ranked = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const units = [...floors];
  for (const entry of ranked) {
    if (remainder <= 0) break;
    units[entry.index] = (units[entry.index] ?? 0) + 1;
    remainder -= 1;
  }

  return units.map((value) => value / 10);
}

export default function buildRepoLanguageBreakdown(
  languages: RepoLanguageBytesMap | null | undefined,
  options: {
    getColor?: (language: string) => string;
  } = {}
): RepoLanguageShare[] {
  if (!languages) return [];

  const entries = Object.entries(languages)
    .filter((entry): entry is [string, number] => {
      const [name, bytes] = entry;
      return Boolean(name) && isPositiveFiniteBytes(bytes);
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (entries.length === 0) return [];

  const totalBytes = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  const percentages = allocatePercentages(
    entries.map(([, bytes]) => bytes),
    totalBytes
  );
  const getColor = options.getColor ?? (() => DEFAULT_COLOR);

  return entries.map(([name, bytes], index) => ({
    name,
    bytes,
    percentage: percentages[index] ?? 0,
    color: getColor(name) || DEFAULT_COLOR,
  }));
}
