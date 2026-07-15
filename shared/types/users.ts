/**
 * User profile, connection (followers/following), and contribution calendar
 * payloads served by the `/api/users/*` routes.
 */

/** Full profile shown on the GitHub-style profile page. */
export interface UserProfilePayload {
  login: string;
  id: number | string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  email: string | null;
  twitterUsername: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  createdAt: string | null;
  type: string | null;
}

/** Compact identity used in follower/following lists. */
export interface UserSummary {
  login: string;
  id: number | string;
  avatarUrl: string | null;
  htmlUrl: string | null;
  /** Present when GitHub returns it (profile hydration); lists omit it. */
  name?: string | null;
  bio?: string | null;
}

/** GitHub's `/users/{username}/followers` and `/following` expose prev/next via Link header only. */
export interface UserConnectionPaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

export interface UserConnectionListResponse {
  items: UserSummary[];
  pagination: UserConnectionPaginationMeta;
}

/** Profile README (from the `username/username` special repository). */
export interface UserReadmeResponse {
  content: string | null;
  htmlUrl: string | null;
  repo: string | null;
  branch: string | null;
}

/** One day cell in the contribution wall. */
export interface ContributionDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  count: number;
  /** GitHub intensity bucket 0–4. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** One column of the wall — up to seven days, Sunday first. */
export interface ContributionWeek {
  days: ContributionDay[];
}

export interface ContributionCalendar {
  totalContributions: number;
  weeks: ContributionWeek[];
}

export type ContributionCalendarResponse = ContributionCalendar;
