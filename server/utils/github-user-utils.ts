import type { H3Event } from 'h3';

import { getGitHubClient } from '#server/utils/github-auth-utils';
import { buildLinkedPaginationMeta } from '#server/utils/github-pagination';
import type {
  UserConnectionListResponse,
  UserProfilePayload,
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
