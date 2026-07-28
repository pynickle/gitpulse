/**
 * Query parsing for GET /api/starred — mirrors GitHub starring list params:
 * https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user
 */

import {
  STARRED_DEFAULT_PER_PAGE,
  STARRED_DIRECTIONS,
  STARRED_MAX_PER_PAGE,
  STARRED_SORTS,
  type StarredDirection,
  type StarredSort,
} from '#shared/utils/starred';

export {
  STARRED_DEFAULT_PER_PAGE,
  STARRED_DIRECTIONS,
  STARRED_MAX_PER_PAGE,
  STARRED_SORTS,
  type StarredDirection,
  type StarredSort,
};

const STARRED_SORT_SET = new Set<string>(STARRED_SORTS);
const STARRED_DIRECTION_SET = new Set<string>(STARRED_DIRECTIONS);

function parseQueryString(value: unknown): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue : null;
}

/** `created` = when starred; `updated` = when the repo was last pushed to. */
export function parseStarredSort(value: unknown, fallback: StarredSort = 'created'): StarredSort {
  const raw = parseQueryString(value);
  return raw && STARRED_SORT_SET.has(raw) ? (raw as StarredSort) : fallback;
}

export function parseStarredDirection(
  value: unknown,
  fallback: StarredDirection = 'desc'
): StarredDirection {
  const raw = parseQueryString(value);
  return raw && STARRED_DIRECTION_SET.has(raw) ? (raw as StarredDirection) : fallback;
}
