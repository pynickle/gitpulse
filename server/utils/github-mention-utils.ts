import type { Octokit } from '@octokit/core';

import type {
  MentionSuggestionsResponse,
  MentionSuggestionUser,
} from '#shared/types/mention-suggestions';
import { buildGitHubMentionUrl, isValidGitHubMentionLogin } from '#shared/utils/markdown-mentions';

import { fetchPaginatedArray } from './github-timeline-utils';

type GitHubClient = Octokit;

interface GitHubUserSummary {
  login?: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

const MENTION_SUGGESTION_LIMIT = 20;
const MENTION_COLLABORATORS_CACHE_TTL_MS = 60_000;
const MENTION_COLLABORATORS_CACHE_MAX_ENTRIES = 100;

interface MentionCollaboratorsCacheEntry {
  expiresAt: number;
  promise: Promise<GitHubUserSummary[]>;
}

const mentionCollaboratorsCache = new Map<string, MentionCollaboratorsCacheEntry>();

function normalizeMentionQuery(query: string) {
  return query.trim().replace(/^@+/, '').slice(0, 39).toLowerCase();
}

function getMentionCollaboratorsCacheKey(owner: string, repo: string, accessTokenCacheKey: string) {
  return `${accessTokenCacheKey}:${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function pruneExpiredMentionCollaboratorsCache(now = Date.now()) {
  for (const [cacheKey, cachedEntry] of mentionCollaboratorsCache) {
    if (cachedEntry.expiresAt <= now) {
      mentionCollaboratorsCache.delete(cacheKey);
    }
  }
}

function enforceMentionCollaboratorsCacheLimit() {
  while (mentionCollaboratorsCache.size > MENTION_COLLABORATORS_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = mentionCollaboratorsCache.keys().next().value;
    if (!oldestCacheKey) {
      return;
    }

    mentionCollaboratorsCache.delete(oldestCacheKey);
  }
}

function fetchRepositoryCollaborators(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  accessTokenCacheKey: string
) {
  const now = Date.now();
  const cacheKey = getMentionCollaboratorsCacheKey(owner, repo, accessTokenCacheKey);
  pruneExpiredMentionCollaboratorsCache(now);

  const cachedEntry = mentionCollaboratorsCache.get(cacheKey);
  if (cachedEntry) {
    mentionCollaboratorsCache.delete(cacheKey);
    mentionCollaboratorsCache.set(cacheKey, cachedEntry);
    return cachedEntry.promise;
  }

  const collaboratorsPromise = fetchPaginatedArray<GitHubUserSummary>(
    octokit,
    'GET /repos/{owner}/{repo}/collaborators',
    {
      owner,
      repo,
      affiliation: 'all',
    }
  ).catch((error: unknown) => {
    mentionCollaboratorsCache.delete(cacheKey);
    throw error;
  });

  mentionCollaboratorsCache.set(cacheKey, {
    expiresAt: now + MENTION_COLLABORATORS_CACHE_TTL_MS,
    promise: collaboratorsPromise,
  });
  enforceMentionCollaboratorsCacheLimit();

  return collaboratorsPromise;
}

function mapMentionSuggestion(user: GitHubUserSummary): MentionSuggestionUser | null {
  const login = user.login?.trim();
  if (!login || !isValidGitHubMentionLogin(login)) {
    return null;
  }

  return {
    login,
    name: user.name ?? null,
    avatarUrl: user.avatar_url ?? null,
    url: user.html_url ?? buildGitHubMentionUrl(login),
  };
}

function matchesMentionQuery(user: MentionSuggestionUser, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  return (
    user.login.toLowerCase().includes(normalizedQuery) ||
    Boolean(user.name?.toLowerCase().includes(normalizedQuery))
  );
}

function sortMentionSuggestions(first: MentionSuggestionUser, second: MentionSuggestionUser) {
  return first.login.localeCompare(second.login, undefined, { sensitivity: 'base' });
}

export async function fetchRepositoryMentionSuggestions(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  options: {
    accessTokenCacheKey: string;
    query?: string;
  }
): Promise<MentionSuggestionsResponse> {
  const normalizedQuery = normalizeMentionQuery(options.query ?? '');
  const collaborators = await fetchRepositoryCollaborators(
    octokit,
    owner,
    repo,
    options.accessTokenCacheKey
  );

  const seen = new Set<string>();
  const items = collaborators
    .map(mapMentionSuggestion)
    .filter((user): user is MentionSuggestionUser => Boolean(user))
    .filter((user) => {
      const key = user.login.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return matchesMentionQuery(user, normalizedQuery);
    })
    .sort(sortMentionSuggestions)
    .slice(0, MENTION_SUGGESTION_LIMIT);

  return {
    query: normalizedQuery,
    items,
  };
}
