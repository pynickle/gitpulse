import { expect, mock, test } from 'bun:test';

import type {
  FollowedRepository,
  FollowedRepositoryMetadataResult,
} from '../shared/types/release-follows';
import * as reactions from '../shared/utils/reactions';
import * as follows from '../shared/utils/release-follows';
import * as searchText from '../shared/utils/release-note-search-text';

mock.module('#shared/utils/reactions', () => reactions);
mock.module('#shared/utils/release-follows', () => follows);
mock.module('#shared/utils/release-note-search-text', () => searchText);

const graphql = await import('../server/utils/release-timeline-graphql-utils');
mock.module('#server/utils/release-timeline-graphql-utils', () => graphql);
const { followedRepositoriesFromMetadataBody, loadFollowedRepositoryMetadata } =
  await import('../server/utils/followed-repository-metadata');

const stored: FollowedRepository[] = [
  { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  { id: 'R_absent', owner: 'octo', name: 'not-on-the-starred-page' },
  { id: 'R_renamed', owner: 'old-owner', name: 'legacy' },
  { id: 'R_partial', owner: 'octo', name: 'partial' },
];

function harness(followsInSettings = stored) {
  const calls: Array<{ query: string; ids: string[] }> = [];
  let response: unknown = { nodes: [] };
  let failure: unknown = null;
  const renames: Array<Record<string, unknown>> = [];
  let failRename = false;

  const load = (follows?: FollowedRepository[]) =>
    loadFollowedRepositoryMetadata({
      octokit: {
        graphql: async (query: string, variables?: Record<string, unknown>) => {
          calls.push({ query, ids: [...((variables?.ids as string[] | undefined) ?? [])] });
          if (failure) {
            const error = failure;
            failure = null;
            throw error;
          }
          return response;
        },
      },
      readSettings: async () => ({ followedRepositories: followsInSettings }),
      renameFollows: async (lookups) => {
        renames.push(lookups);
        if (failRename) throw new Error('storage down');
      },
      follows,
    });

  return {
    load,
    calls,
    renames,
    setResponse: (value: unknown) => {
      response = value;
    },
    fail: (error: unknown) => {
      failure = error;
    },
    failRename: () => {
      failRename = true;
    },
  };
}

test('reads metadata for the stored follows, including repositories absent from the current Starred page', async () => {
  const app = harness();
  app.setResponse({
    nodes: [
      {
        id: 'R_widgets',
        nameWithOwner: 'octo/widgets',
        description: '  A dashboard for GitHub reviews  ',
        primaryLanguage: { name: 'TypeScript' },
        stargazerCount: 1200,
        repositoryTopics: { nodes: [{ topic: { name: 'zyx-topic' } }] },
      },
      {
        id: 'R_absent',
        nameWithOwner: 'octo/not-on-the-starred-page',
        description: '',
        primaryLanguage: null,
        stargazerCount: 0,
      },
      {
        id: 'R_renamed',
        name: 'legacy',
        nameWithOwner: 'new-owner/legacy',
        description: null,
        primaryLanguage: { name: '   ' },
        stargazerCount: 12,
      },
      {
        id: 'R_partial',
        nameWithOwner: 'octo/partial',
        description: 'Stars failed to load',
        primaryLanguage: { name: 'Go' },
        stargazerCount: null,
      },
    ],
  });

  const result = await app.load();

  expect(app.calls).toHaveLength(1);
  expect(app.calls[0]?.ids).toEqual(['R_widgets', 'R_absent', 'R_renamed', 'R_partial']);
  expect(app.calls[0]?.query).not.toContain('repositoryTopics');
  expect(result.repositories.R_widgets).toEqual({
    status: 'available',
    owner: 'octo',
    name: 'widgets',
    description: 'A dashboard for GitHub reviews',
    primaryLanguage: 'TypeScript',
    starCount: 1200,
  });
  expect(result.repositories.R_absent).toEqual({
    status: 'available',
    owner: 'octo',
    name: 'not-on-the-starred-page',
    description: null,
    primaryLanguage: null,
    starCount: 0,
  });
  expect(result.repositories.R_renamed).toEqual({
    status: 'available',
    owner: 'new-owner',
    name: 'legacy',
    description: null,
    primaryLanguage: null,
    starCount: 12,
  });
  expect(result.repositories.R_partial).toEqual({ status: 'transient' });
  expect(JSON.stringify(result)).not.toContain('zyx-topic');
  expect(result.renamed).toBe(true);
  expect(app.renames).toEqual([
    {
      R_widgets: { status: 'available', owner: 'octo', name: 'widgets' },
      R_absent: {
        status: 'available',
        owner: 'octo',
        name: 'not-on-the-starred-page',
      },
      R_renamed: { status: 'available', owner: 'new-owner', name: 'legacy' },
      R_partial: { status: 'transient' },
    },
  ]);
});

test('distinguishes a confirmed missing repository from a rate limit and a short payload', async () => {
  const app = harness([
    { id: 'R_missing', owner: 'octo', name: 'gone' },
    { id: 'R_ok', owner: 'octo', name: 'ok' },
    { id: 'R_short', owner: 'octo', name: 'short' },
  ]);
  app.setResponse({
    nodes: [
      null,
      {
        nameWithOwner: 'octo/ok',
        description: 'Still here',
        primaryLanguage: { name: 'Rust' },
        stargazerCount: 0,
      },
    ],
  });

  const partial = await app.load();
  expect(partial.repositories).toEqual({
    R_missing: { status: 'unavailable' },
    R_ok: {
      status: 'available',
      owner: 'octo',
      name: 'ok',
      description: 'Still here',
      primaryLanguage: 'Rust',
      starCount: 0,
    },
    R_short: { status: 'transient' },
  });
  expect(partial.renamed).toBe(false);
  expect(app.renames).toEqual([]);

  app.fail(new Error('API rate limit exceeded'));
  const limited = await app.load();
  expect(limited).toEqual({
    repositories: {
      R_missing: { status: 'transient' },
      R_ok: { status: 'transient' },
      R_short: { status: 'transient' },
    },
    renamed: false,
  } satisfies FollowedRepositoryMetadataResult);
  expect(app.renames).toEqual([]);
});

test('keeps partial GraphQL failures retryable while preserving successful and missing results', async () => {
  const app = harness([
    { id: 'R_failed', owner: 'octo', name: 'failed' },
    { id: 'R_partial', owner: 'octo', name: 'partial' },
    { id: 'R_missing', owner: 'octo', name: 'missing' },
    { id: 'R_ok', owner: 'octo', name: 'ok' },
  ]);
  const availableNode = {
    nameWithOwner: 'octo/ok',
    description: 'Still here',
    primaryLanguage: null,
    stargazerCount: 0,
  };
  app.fail({
    data: {
      nodes: [
        null,
        { ...availableNode, nameWithOwner: 'octo/partial', description: null },
        null,
        availableNode,
      ],
    },
    errors: [
      { type: 'INTERNAL', path: ['nodes', 0] },
      { type: 'INTERNAL', path: ['nodes', 1, 'description'] },
      { type: 'NOT_FOUND', path: ['nodes', 2] },
    ],
  });

  const result = await app.load();
  expect(result.repositories).toEqual({
    R_failed: { status: 'transient' },
    R_partial: { status: 'transient' },
    R_missing: { status: 'unavailable' },
    R_ok: {
      status: 'available',
      owner: 'octo',
      name: 'ok',
      description: 'Still here',
      primaryLanguage: null,
      starCount: 0,
    },
  });
  expect(app.renames).toEqual([]);
});

test('treats a partial rate limit without a node path as transient', async () => {
  const app = harness([{ id: 'R_failed', owner: 'octo', name: 'failed' }]);
  app.fail({ data: { nodes: [null] }, errors: [{ type: 'RATE_LIMITED' }] });

  expect((await app.load()).repositories).toEqual({ R_failed: { status: 'transient' } });
});

test('keeps metadata when a rename write fails and skips GitHub when nothing is followed', async () => {
  const app = harness([{ id: 'R_renamed', owner: 'old-owner', name: 'legacy' }]);
  app.failRename();
  app.setResponse({
    nodes: [
      {
        nameWithOwner: 'new-owner/legacy',
        description: 'Renamed',
        primaryLanguage: null,
        stargazerCount: 4,
      },
    ],
  });

  const result = await app.load();
  expect(result.renamed).toBe(true);
  expect(result.repositories.R_renamed).toMatchObject({
    status: 'available',
    owner: 'new-owner',
    name: 'legacy',
    starCount: 4,
  });
  expect(app.renames).toHaveLength(1);

  const empty = harness([]);
  expect(await empty.load()).toEqual({ repositories: {}, renamed: false });
  expect(empty.calls).toEqual([]);
});

test('loads a newly followed repository before it is stored', async () => {
  const app = harness([]);
  app.setResponse({
    nodes: [
      {
        id: 'R_new',
        nameWithOwner: 'new/lib',
        description: 'Brand new',
        primaryLanguage: { name: 'Rust' },
        stargazerCount: 1,
      },
    ],
  });

  expect(followedRepositoriesFromMetadataBody(null)).toEqual([]);
  expect(
    followedRepositoriesFromMetadataBody({
      repositories: [{ id: '', owner: 'drop', name: 'me' }],
    })
  ).toEqual([]);
  const capped = followedRepositoriesFromMetadataBody({
    repositories: Array.from({ length: 200 }, (_, index) => ({
      id: `R_${index}`,
      owner: 'extra',
      name: `repo-${index}`,
    })),
  });
  expect(capped).toHaveLength(150);
  expect(capped[0]?.id).toBe('R_0');
  expect(capped.at(-1)?.id).toBe('R_149');

  const result = await app.load([{ id: 'R_new', owner: 'new', name: 'lib' }]);
  expect(app.calls[0]?.ids).toEqual(['R_new']);
  expect(result.repositories.R_new).toEqual({
    status: 'available',
    owner: 'new',
    name: 'lib',
    description: 'Brand new',
    primaryLanguage: 'Rust',
    starCount: 1,
  });
  expect(result.renamed).toBe(false);
  expect(app.renames).toEqual([]);
});
