import { getOneYearAgoSearchDate } from '#shared/utils/github-search-query';

export function getOneYearAgoDate(): string {
  return getOneYearAgoSearchDate();
}
