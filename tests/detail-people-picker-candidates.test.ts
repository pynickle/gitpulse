import { describe, expect, test } from 'bun:test';

import type { DetailPeoplePickerCandidate } from '../app/types/detail-people-picker';
import filterDetailPeoplePickerCandidates from '../app/utils/filterDetailPeoplePickerCandidates';

const candidates: DetailPeoplePickerCandidate[] = [
  {
    key: 'user:alice',
    kind: 'user',
    name: 'Alice',
    login: 'alice-dev',
  },
  {
    key: 'team:frontend',
    kind: 'team',
    name: 'Frontend Core',
    slug: 'frontend-core',
  },
  {
    key: 'user:bob',
    kind: 'user',
    name: 'Bob',
    login: 'bob-maintainer',
    badgeLabel: 'Assigned',
  },
];

describe('filterDetailPeoplePickerCandidates', () => {
  test('returns the original candidate list for an empty query', () => {
    expect(filterDetailPeoplePickerCandidates(candidates, '')).toBe(candidates);
    expect(filterDetailPeoplePickerCandidates(candidates, '   ')).toBe(candidates);
  });

  test('filters candidates locally with case-insensitive partial matches', () => {
    expect(filterDetailPeoplePickerCandidates(candidates, 'ali')).toEqual([candidates[0]]);
    expect(filterDetailPeoplePickerCandidates(candidates, 'FRONT')).toEqual([candidates[1]]);
  });

  test('matches searchable identity and badge fields', () => {
    expect(filterDetailPeoplePickerCandidates(candidates, 'maintainer')).toEqual([candidates[2]]);
    expect(filterDetailPeoplePickerCandidates(candidates, 'assigned')).toEqual([candidates[2]]);
    expect(filterDetailPeoplePickerCandidates(candidates, 'team:front')).toEqual([candidates[1]]);
  });
});
