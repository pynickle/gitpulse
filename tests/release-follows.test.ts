import { describe, expect, test } from 'bun:test';

import {
  FOLLOW_STORED_CAP,
  FOLLOW_VALID_CAP,
  type FollowedRepository,
} from '../shared/types/release-follows';
import {
  applyFollowAdd,
  applyFollowClear,
  applyFollowRemove,
  getFollowAddBlock,
  normalizeFollowedRepositories,
} from '../shared/utils/release-follows';

const repo = (
  overrides: Partial<FollowedRepository> & Pick<FollowedRepository, 'id'>
): FollowedRepository => ({
  owner: overrides.owner ?? 'octo',
  name: overrides.name ?? `repo-${overrides.id}`,
  ...overrides,
});

const listOf = (count: number, idPrefix = 'R_') => {
  return Array.from({ length: count }, (_, index) => repo({ id: `${idPrefix}${index}` }));
};

describe('normalizeFollowedRepositories', () => {
  test('returns an empty list when the value is missing or not an array', () => {
    expect(normalizeFollowedRepositories(undefined)).toEqual([]);
    expect(normalizeFollowedRepositories(null)).toEqual([]);
    expect(normalizeFollowedRepositories({})).toEqual([]);
    expect(normalizeFollowedRepositories('R_1')).toEqual([]);
  });

  test('keeps newest-first identity rows and drops invalid entries', () => {
    expect(
      normalizeFollowedRepositories([
        { id: 'R_new', owner: ' octo ', name: ' widgets ' },
        { id: '', owner: 'octo', name: 'skip-empty-id' },
        { id: 'R_numeric', owner: 'octo', name: 'rest-id-as-number' },
        42,
        { id: 'R_no_owner', owner: '', name: 'widgets' },
        { id: 'R_no_name', owner: 'octo', name: '  ' },
        { id: 'R_old', owner: 'hubot', name: 'scripts' },
      ])
    ).toEqual([
      { id: 'R_new', owner: 'octo', name: 'widgets' },
      { id: 'R_numeric', owner: 'octo', name: 'rest-id-as-number' },
      { id: 'R_old', owner: 'hubot', name: 'scripts' },
    ]);
  });

  test('keeps the first occurrence of a duplicated GraphQL id', () => {
    expect(
      normalizeFollowedRepositories([
        { id: 'R_same', owner: 'octo', name: 'newest-name' },
        { id: 'R_other', owner: 'octo', name: 'other' },
        { id: 'R_same', owner: 'octo', name: 'stale-name' },
      ])
    ).toEqual([
      { id: 'R_same', owner: 'octo', name: 'newest-name' },
      { id: 'R_other', owner: 'octo', name: 'other' },
    ]);
  });

  test('caps stored rows at 150 while preserving newest-first order', () => {
    const raw = listOf(FOLLOW_STORED_CAP + 5);
    const normalized = normalizeFollowedRepositories(raw);

    expect(normalized).toHaveLength(FOLLOW_STORED_CAP);
    expect(normalized[0]?.id).toBe('R_0');
    expect(normalized[FOLLOW_STORED_CAP - 1]?.id).toBe(`R_${FOLLOW_STORED_CAP - 1}`);
  });
});

describe('applyFollowAdd', () => {
  test('prepends a new Followed Repository as the newest follow', () => {
    const existing = [repo({ id: 'R_old', name: 'old' })];

    expect(applyFollowAdd(existing, repo({ id: 'R_new', name: 'new' }), new Set())).toEqual({
      ok: true,
      list: [repo({ id: 'R_new', name: 'new' }), repo({ id: 'R_old', name: 'old' })],
    });
  });

  test('rejects a duplicate GraphQL id without reordering the list', () => {
    const existing = [repo({ id: 'R_new' }), repo({ id: 'R_old' })];

    expect(applyFollowAdd(existing, repo({ id: 'R_old', name: 'renamed' }), new Set())).toEqual({
      ok: false,
      error: 'duplicate',
    });
  });

  test('treats every stored row as valid when no Unavailable ids are given and blocks at 100', () => {
    const existing = listOf(FOLLOW_VALID_CAP);

    expect(getFollowAddBlock(existing, new Set())).toBe('valid-cap');
    expect(applyFollowAdd(existing, repo({ id: 'R_overflow' }), new Set())).toEqual({
      ok: false,
      error: 'valid-cap',
    });
  });

  test('does not count Unavailable Followed Repositories toward the 100 valid cap', () => {
    const existing = [...listOf(FOLLOW_VALID_CAP - 1), repo({ id: 'R_gone', name: 'gone' })];

    expect(applyFollowAdd(existing, repo({ id: 'R_next' }), new Set(['R_gone']))).toEqual({
      ok: true,
      list: [repo({ id: 'R_next' }), ...existing],
    });
  });

  test('blocks adds at 150 stored rows even when some are Unavailable', () => {
    const existing = listOf(FOLLOW_STORED_CAP);
    const unavailableIds = new Set(existing.slice(0, 50).map((item) => item.id));

    expect(getFollowAddBlock(existing, unavailableIds)).toBe('stored-cap');
    expect(applyFollowAdd(existing, repo({ id: 'R_overflow' }), unavailableIds)).toEqual({
      ok: false,
      error: 'stored-cap',
    });
  });
});

describe('applyFollowRemove and applyFollowClear', () => {
  test('removes by GraphQL id and keeps the remaining newest-first order', () => {
    const existing = [repo({ id: 'R_a' }), repo({ id: 'R_b' }), repo({ id: 'R_c' })];

    expect(applyFollowRemove(existing, 'R_b')).toEqual([repo({ id: 'R_a' }), repo({ id: 'R_c' })]);
    expect(applyFollowRemove(existing, 'R_missing')).toEqual(existing);
  });

  test('clears every stored Followed Repository', () => {
    expect(applyFollowClear()).toEqual([]);
  });
});
