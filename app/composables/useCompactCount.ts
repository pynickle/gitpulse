import { formatCompactNumber } from '../utils/formatCompactNumber';

/**
 * Count formatting for chrome that cannot afford a six-digit number: `compact`
 * is the reader's abbreviated value (5.2K / 5.2万), `exact` the grouped one for
 * the element's title. A missing or non-finite count renders as zero.
 */
export function useCompactCount() {
  const { locale } = useI18n();

  const normalize = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;

  return {
    compact: (value: number | null | undefined) =>
      formatCompactNumber(normalize(value), locale.value),
    exact: (value: number | null | undefined) => normalize(value).toLocaleString(locale.value),
  };
}
