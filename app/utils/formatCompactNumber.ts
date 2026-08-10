/**
 * Locale-aware compact count formatting (e.g. en: 5.6K, zh-CN: 1.2万).
 * Non-finite values render as `"0"`.
 */
export default function formatCompactNumber(
  value: number,
  locale: string = 'en',
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) return '0';

  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}
