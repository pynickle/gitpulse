import { describe, expect, test } from 'bun:test';

import {
  mapGraphQLRepositoryToSummary,
  normalizePinnedRepositories,
} from '../server/utils/github-pinned-repo-utils';

const buildRepositoryNode = (overrides: Record<string, unknown> = {}) => ({
  id: 'R_node1',
  databaseId: 42,
  name: 'hello-world',
  nameWithOwner: 'octocat/hello-world',
  description: 'My first repo',
  isPrivate: false,
  isFork: false,
  isArchived: false,
  stargazerCount: 128,
  forkCount: 16,
  primaryLanguage: { name: 'TypeScript' },
  owner: { login: 'octocat' },
  ...overrides,
});

describe('mapGraphQLRepositoryToSummary', () => {
  test('maps a repository node onto the REST-cased summary', () => {
    expect(mapGraphQLRepositoryToSummary(buildRepositoryNode())).toEqual({
      id: 42,
      name: 'hello-world',
      full_name: 'octocat/hello-world',
      description: 'My first repo',
      language: 'TypeScript',
      stargazers_count: 128,
      // REST reports watchers equal to stars; the GraphQL mapping mirrors that.
      watchers_count: 128,
      forks_count: 16,
      private: false,
      fork: false,
      archived: false,
      owner: { login: 'octocat' },
    });
  });

  test('falls back to the node id and composed full name', () => {
    const summary = mapGraphQLRepositoryToSummary(
      buildRepositoryNode({ databaseId: null, nameWithOwner: null })
    );

    expect(summary?.id).toBe('R_node1');
    expect(summary?.full_name).toBe('octocat/hello-world');
  });

  test('returns null for nodes missing a name or owner', () => {
    expect(mapGraphQLRepositoryToSummary(null)).toBeNull();
    expect(mapGraphQLRepositoryToSummary(buildRepositoryNode({ name: null }))).toBeNull();
    expect(mapGraphQLRepositoryToSummary(buildRepositoryNode({ owner: null }))).toBeNull();
  });
});

describe('normalizePinnedRepositories', () => {
  test('prefers pinned items when present', () => {
    const result = normalizePinnedRepositories({
      repositoryOwner: {
        pinnedItems: { nodes: [buildRepositoryNode()] },
        repositories: { nodes: [buildRepositoryNode({ name: 'popular-repo' })] },
      },
    });

    expect(result.source).toBe('pinned');
    expect(result.items.map((repo) => repo.name)).toEqual(['hello-world']);
  });

  test('falls back to popular repositories when nothing is pinned', () => {
    const result = normalizePinnedRepositories({
      repositoryOwner: {
        pinnedItems: { nodes: [] },
        repositories: { nodes: [buildRepositoryNode({ name: 'popular-repo' })] },
      },
    });

    expect(result.source).toBe('popular');
    expect(result.items.map((repo) => repo.name)).toEqual(['popular-repo']);
  });

  test('resolves a missing owner to an empty popular list', () => {
    expect(normalizePinnedRepositories({ repositoryOwner: null })).toEqual({
      items: [],
      source: 'popular',
    });
  });

  test('skips malformed nodes', () => {
    const result = normalizePinnedRepositories({
      repositoryOwner: {
        pinnedItems: { nodes: [null, buildRepositoryNode({ owner: {} }), buildRepositoryNode()] },
      },
    });

    expect(result.items.map((repo) => repo.full_name)).toEqual(['octocat/hello-world']);
  });
});
