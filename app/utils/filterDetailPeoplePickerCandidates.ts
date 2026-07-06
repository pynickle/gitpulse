import type { DetailPeoplePickerCandidate } from '../types/detail-people-picker';

export default function filterDetailPeoplePickerCandidates(
  candidates: DetailPeoplePickerCandidate[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return candidates;

  return candidates.filter((candidate) => {
    const searchableValues = [
      candidate.key,
      candidate.name,
      candidate.login,
      candidate.slug,
      candidate.badgeLabel,
    ];

    return searchableValues.some((value) => value?.toLowerCase().includes(normalizedQuery));
  });
}
