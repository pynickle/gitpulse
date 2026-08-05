import type {
  RepoContributorListResponse,
  RepoContributorStatsItem,
  RepoContributorStatsResponse,
  RepoContributorSummary,
  RepoContributorWeek,
} from '#shared/types/repos';

/** Subset of GitHub list-contributors JSON (users + optional anonymous). */
export interface GitHubContributorListItem {
  login?: string | null;
  id?: number | string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  type?: string | null;
  contributions?: number | null;
  /** Present on anonymous contributor entries when `anon=1`. */
  name?: string | null;
  email?: string | null;
}

interface GitHubContributorWeek {
  w?: number | null;
  a?: number | null;
  d?: number | null;
  c?: number | null;
}

interface GitHubContributorAuthor {
  login?: string | null;
  id?: number | string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  type?: string | null;
}

/** Subset of GitHub stats/contributors JSON. */
export interface GitHubContributorStatsItem {
  total?: number | null;
  weeks?: GitHubContributorWeek[] | null;
  author?: GitHubContributorAuthor | null;
}

const toCount = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
};

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/**
 * Map a list-contributors entry. Returns null when the item has no usable
 * identity (no login and no anonymous name) — keeps the client list clean.
 */
export function mapGitHubContributorListItem(
  raw: GitHubContributorListItem | null | undefined
): RepoContributorSummary | null {
  if (!raw || typeof raw !== 'object') return null;

  const login = toNonEmptyString(raw.login);
  const name = toNonEmptyString(raw.name);
  const type = toNonEmptyString(raw.type) ?? (login ? 'User' : 'Anonymous');
  const anonymous = type === 'Anonymous' || !login;

  if (!login && !name) return null;

  return {
    login,
    id: raw.id ?? null,
    avatarUrl: toNonEmptyString(raw.avatar_url),
    htmlUrl: toNonEmptyString(raw.html_url),
    name,
    contributions: toCount(raw.contributions),
    type,
    anonymous,
  };
}

export function mapGitHubContributorStatsItem(
  raw: GitHubContributorStatsItem | null | undefined
): RepoContributorStatsItem | null {
  if (!raw || typeof raw !== 'object') return null;

  const author = raw.author;
  const login = toNonEmptyString(author?.login);
  // Stats rows without an author (deleted accounts) still carry totals.
  const weeks: RepoContributorWeek[] = (Array.isArray(raw.weeks) ? raw.weeks : [])
    .map((week) => {
      const weekStart = typeof week?.w === 'number' && Number.isFinite(week.w) ? week.w : null;
      if (weekStart === null) return null;
      return {
        week: weekStart,
        additions: toCount(week?.a),
        deletions: toCount(week?.d),
        commits: toCount(week?.c),
      } satisfies RepoContributorWeek;
    })
    .filter((week): week is RepoContributorWeek => week !== null);

  return {
    login,
    id: author?.id ?? null,
    avatarUrl: toNonEmptyString(author?.avatar_url),
    htmlUrl: toNonEmptyString(author?.html_url),
    total: toCount(raw.total),
    weeks,
  };
}

/**
 * Normalize a stats endpoint response. GitHub returns 202 while computing and
 * 204 when there is nothing to show; both become empty `items` with a status.
 * Ready payloads are sorted by total commits descending (GitHub graphs order).
 */
export function normalizeContributorStatsResponse(options: {
  status: number;
  data: unknown;
}): RepoContributorStatsResponse {
  const { status, data } = options;

  if (status === 202) {
    return { status: 'computing', items: [] };
  }

  if (status === 204 || data == null || data === '') {
    return { status: 'empty', items: [] };
  }

  if (!Array.isArray(data)) {
    // Rare: some clients see `{}` while a job is still spinning up.
    return { status: 'computing', items: [] };
  }

  if (data.length === 0) {
    return { status: 'empty', items: [] };
  }

  const items = data
    .map((entry) => mapGitHubContributorStatsItem(entry as GitHubContributorStatsItem))
    .filter((entry): entry is RepoContributorStatsItem => entry !== null)
    .sort(
      (left, right) =>
        right.total - left.total || (left.login ?? '').localeCompare(right.login ?? '')
    );

  return { status: 'ready', items };
}

/** Build an empty list payload for empty repositories (GitHub 204). */
export function emptyContributorListResponse(
  page: number,
  perPage: number
): RepoContributorListResponse {
  return {
    items: [],
    pagination: {
      page: 1,
      perPage,
      hasPrev: false,
      hasNext: false,
      totalCount: 0,
      totalPages: 1,
    },
  };
}
