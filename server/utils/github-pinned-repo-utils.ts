import type { Octokit } from '@octokit/core';

import type { UserPinnedReposResponse, UserRepositorySummary } from '#shared/types/users';

/** GitHub shows at most six pinned (or popular fallback) repositories. */
const PINNED_REPOS_COUNT = 6;

/** GraphQL `Repository` fields needed to render the shared repo card. */
const PINNED_REPO_FIELDS_FRAGMENT = `
  fragment PinnedRepoFields on Repository {
    id
    databaseId
    name
    nameWithOwner
    description
    isPrivate
    isFork
    isArchived
    stargazerCount
    forkCount
    primaryLanguage {
      name
    }
    owner {
      login
    }
  }
`;

export const PINNED_REPOSITORIES_QUERY = `
  query UserPinnedRepositories($login: String!, $count: Int!) {
    repositoryOwner(login: $login) {
      ... on User {
        pinnedItems(first: $count, types: [REPOSITORY]) {
          nodes {
            ... on Repository {
              ...PinnedRepoFields
            }
          }
        }
      }
      ... on Organization {
        pinnedItems(first: $count, types: [REPOSITORY]) {
          nodes {
            ... on Repository {
              ...PinnedRepoFields
            }
          }
        }
      }
      repositories(
        first: $count
        orderBy: { field: STARGAZERS, direction: DESC }
        privacy: PUBLIC
        ownerAffiliations: OWNER
      ) {
        nodes {
          ...PinnedRepoFields
        }
      }
    }
  }
  ${PINNED_REPO_FIELDS_FRAGMENT}
`;

export interface GraphQLRepositoryNode {
  id?: string;
  databaseId?: number | null;
  name?: string | null;
  nameWithOwner?: string | null;
  description?: string | null;
  isPrivate?: boolean;
  isFork?: boolean;
  isArchived?: boolean;
  stargazerCount?: number;
  forkCount?: number;
  primaryLanguage?: { name?: string | null } | null;
  owner?: { login?: string | null } | null;
}

interface GraphQLRepositoryConnection {
  nodes?: (GraphQLRepositoryNode | null)[] | null;
}

export interface GraphQLPinnedRepositoriesResponse {
  repositoryOwner?: {
    pinnedItems?: GraphQLRepositoryConnection | null;
    repositories?: GraphQLRepositoryConnection | null;
  } | null;
}

const toCount = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value : null;
};

/**
 * Map a GraphQL repository node onto the REST-cased summary the shared repo
 * card consumes. GitHub REST reports `watchers_count` equal to the star count,
 * so the GraphQL mapping mirrors that for visual parity with the repo tabs.
 */
export function mapGraphQLRepositoryToSummary(
  node: GraphQLRepositoryNode | null | undefined
): UserRepositorySummary | null {
  const name = toNonEmptyString(node?.name);
  const ownerLogin = toNonEmptyString(node?.owner?.login);

  if (!node || !name || !ownerLogin) {
    return null;
  }

  const stargazers = toCount(node.stargazerCount);

  return {
    id: node.databaseId ?? node.id ?? `${ownerLogin}/${name}`,
    name,
    full_name: toNonEmptyString(node.nameWithOwner) ?? `${ownerLogin}/${name}`,
    description: toNonEmptyString(node.description),
    language: toNonEmptyString(node.primaryLanguage?.name),
    stargazers_count: stargazers,
    watchers_count: stargazers,
    forks_count: toCount(node.forkCount),
    private: Boolean(node.isPrivate),
    fork: Boolean(node.isFork),
    archived: Boolean(node.isArchived),
    owner: { login: ownerLogin },
  };
}

const mapConnectionNodes = (
  connection: GraphQLRepositoryConnection | null | undefined
): UserRepositorySummary[] => {
  return (Array.isArray(connection?.nodes) ? connection!.nodes! : [])
    .map((node) => mapGraphQLRepositoryToSummary(node))
    .filter((repo): repo is UserRepositorySummary => repo !== null);
};

/**
 * Pick pinned items when the owner has any, otherwise fall back to the
 * most-starred public repositories — the same fallback GitHub renders as
 * "Popular repositories". Missing owners resolve to an empty list.
 */
export function normalizePinnedRepositories(
  response: GraphQLPinnedRepositoriesResponse
): UserPinnedReposResponse {
  const owner = response.repositoryOwner;
  const pinned = mapConnectionNodes(owner?.pinnedItems);

  if (pinned.length > 0) {
    return { items: pinned, source: 'pinned' };
  }

  return { items: mapConnectionNodes(owner?.repositories), source: 'popular' };
}

/**
 * GraphQL lookups over deleted/renamed repos reject with partial `data`
 * alongside NOT_FOUND errors; surviving fields are still usable.
 */
const getPartialGraphQLData = <T>(error: unknown): T | null => {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data &&
    typeof error.data === 'object'
  ) {
    return error.data as T;
  }

  return null;
};

/** GitHub's default pin list for a login: pinned items, else most-starred. */
export async function fetchDefaultPinnedRepositories(
  octokit: Octokit,
  login: string
): Promise<UserPinnedReposResponse> {
  let response: GraphQLPinnedRepositoriesResponse;

  try {
    response = await octokit.graphql<GraphQLPinnedRepositoriesResponse>(PINNED_REPOSITORIES_QUERY, {
      login,
      count: PINNED_REPOS_COUNT,
    });
  } catch (error: unknown) {
    const partial = getPartialGraphQLData<GraphQLPinnedRepositoriesResponse>(error);
    if (!partial) {
      throw error;
    }
    response = partial;
  }

  return normalizePinnedRepositories(response);
}
