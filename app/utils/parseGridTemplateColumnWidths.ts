/**
 * Parses the resolved track widths from a computed `grid-template-columns`
 * value (e.g. `'272px 811.5px 352px'`). Non-length tracks parse as `NaN` so
 * callers can validate entries before using them.
 */
export default function parseGridTemplateColumnWidths(value: string): number[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((track) => track.length > 0)
    .map((track) => Number.parseFloat(track));
}
