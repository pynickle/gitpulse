/**
 * Formats a GitHub release asset byte size for display.
 * Returns null when the size is missing or not a positive finite number.
 */
export default function formatReleaseAssetSize(size: number): string | null {
  if (!Number.isFinite(size) || size <= 0) return null;

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
