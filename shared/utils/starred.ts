/**
 * Shared constants for starred repositories listing.
 * Aligns with GitHub starring API:
 * https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user
 */

export const STARRED_SORTS = ['created', 'updated'] as const;
export type StarredSort = (typeof STARRED_SORTS)[number];

export const STARRED_DIRECTIONS = ['asc', 'desc'] as const;
export type StarredDirection = (typeof STARRED_DIRECTIONS)[number];

/**
 * Default page size for the starred grid (3 columns).
 * Must be divisible by 3 so full pages fill every row; GitHub max is 100.
 */
export const STARRED_DEFAULT_PER_PAGE = 30;
export const STARRED_MAX_PER_PAGE = 100;
