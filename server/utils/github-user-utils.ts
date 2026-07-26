import type { H3Event } from 'h3';

import { getGitHubClient } from '#server/utils/github-auth-utils';
import { buildLinkedPaginationMeta } from '#server/utils/github-pagination';
import type {
  UserConnectionListResponse,
  UserOrganizationSummary,
  UserProfilePayload,
  UserRepositorySummary,
  UserSummary,
} from '#shared/types/users';

/** GitHub login rules: 1–39 chars, alphanumeric or single hyphens, no leading/trailing hyphen. */
const GITHUB_USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** Extract and validate the `username` route param. */
export function extractUsername(event: H3Event): string {
  const { username } = event.context.params as { username?: string };
  const normalized = typeof username === 'string' ? username.trim() : '';

  if (!normalized || !GITHUB_USERNAME_PATTERN.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid GitHub username',
    });
  }

  return normalized;
}

/** Validate an optional username taken from a query param; null when absent, 400 when malformed. */
export function parseOptionalGitHubUsername(value: unknown): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!normalized) {
    return null;
  }

  if (!GITHUB_USERNAME_PATTERN.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid GitHub username',
    });
  }

  return normalized;
}

/** Shape of a GitHub REST user object (public profile fields we surface). */
export interface GitHubUserResponse {
  login?: string;
  id?: number | string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  email?: string | null;
  twitter_username?: string | null;
  followers?: number;
  following?: number;
  public_repos?: number;
  public_gists?: number;
  created_at?: string | null;
  type?: string | null;
}

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value : null;
};

const toCount = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export function mapGitHubUserToProfile(user: GitHubUserResponse): UserProfilePayload {
  return {
    login: user.login ?? '',
    id: user.id ?? '',
    name: toNonEmptyString(user.name),
    avatarUrl: toNonEmptyString(user.avatar_url),
    htmlUrl: toNonEmptyString(user.html_url),
    bio: toNonEmptyString(user.bio),
    company: toNonEmptyString(user.company),
    location: toNonEmptyString(user.location),
    blog: toNonEmptyString(user.blog),
    email: toNonEmptyString(user.email),
    twitterUsername: toNonEmptyString(user.twitter_username),
    followers: toCount(user.followers),
    following: toCount(user.following),
    publicRepos: toCount(user.public_repos),
    publicGists: toCount(user.public_gists),
    createdAt: toNonEmptyString(user.created_at),
    type: toNonEmptyString(user.type),
  };
}

export function mapGitHubUserToSummary(user: GitHubUserResponse): UserSummary | null {
  const login = toNonEmptyString(user.login);
  if (!login) {
    return null;
  }

  return {
    login,
    id: user.id ?? login,
    avatarUrl: toNonEmptyString(user.avatar_url),
    htmlUrl: toNonEmptyString(user.html_url),
  };
}

/** Shape of a GitHub REST repository object (fields the profile repo list surfaces). */
export interface GitHubRepositoryResponse {
  id?: number | string;
  name?: string;
  full_name?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  owner?: { login?: string | null } | null;
}

export function mapGitHubRepositoryToSummary(
  repo: GitHubRepositoryResponse
): UserRepositorySummary | null {
  const name = toNonEmptyString(repo.name);
  if (!name) {
    return null;
  }

  const ownerLogin = toNonEmptyString(repo.owner?.login);
  const fullName =
    toNonEmptyString(repo.full_name) ?? (ownerLogin ? `${ownerLogin}/${name}` : name);

  return {
    id: repo.id ?? fullName,
    name,
    full_name: fullName,
    description: toNonEmptyString(repo.description),
    language: toNonEmptyString(repo.language),
    stargazers_count: toCount(repo.stargazers_count),
    watchers_count: toCount(repo.watchers_count),
    forks_count: toCount(repo.forks_count),
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    owner: { login: ownerLogin ?? '' },
  };
}

/** Shape of a GitHub REST organization object (from `/users/{username}/orgs`). */
export interface GitHubOrganizationResponse {
  login?: string;
  id?: number | string;
  avatar_url?: string | null;
  description?: string | null;
}

/** `/users/{username}/orgs` has no `html_url`; the org page URL is derived from the login. */
export function mapGitHubOrganizationToSummary(
  org: GitHubOrganizationResponse
): UserOrganizationSummary | null {
  const login = toNonEmptyString(org.login);
  if (!login) {
    return null;
  }

  return {
    login,
    id: org.id ?? login,
    avatarUrl: toNonEmptyString(org.avatar_url),
    htmlUrl: `https://github.com/${encodeURIComponent(login)}`,
    description: toNonEmptyString(org.description),
  };
}

/**
 * Fetch one page of a user's followers or following list, translating GitHub's
 * Link-header pagination into the shape the connection panel consumes.
 */
export async function fetchUserConnectionPage(
  event: H3Event,
  options: {
    username: string;
    relation: 'followers' | 'following';
    page: number;
    perPage: number;
  }
): Promise<UserConnectionListResponse> {
  const { username, relation, page, perPage } = options;
  const octokit = await getGitHubClient(event);

  const route =
    relation === 'followers'
      ? ('GET /users/{username}/followers' as const)
      : ('GET /users/{username}/following' as const);

  const { data, headers } = await octokit.request(route, {
    username,
    page,
    per_page: perPage,
  });

  const items = (Array.isArray(data) ? (data as GitHubUserResponse[]) : [])
    .map((user) => mapGitHubUserToSummary(user))
    .filter((summary): summary is UserSummary => summary !== null);

  return {
    items,
    pagination: buildLinkedPaginationMeta({
      page,
      perPage,
      linkHeader: headers.link,
    }),
  };
}
