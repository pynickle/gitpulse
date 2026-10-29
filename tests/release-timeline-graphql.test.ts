import { describe, expect, mock, test } from 'bun:test';

const reactions = await import('../shared/utils/reactions');
mock.module('#shared/utils/reactions', () => reactions);
const searchText = await import('../shared/utils/release-note-search-text');
mock.module('#shared/utils/release-note-search-text', () => searchText);

const {
  fetchFollowedRepositoryIdentityLookups,
  fetchFollowedRepositoryReleaseLookups,
  mapRepositoryIdentityLookup,
  mapRepositoryReleaseLookup,
} = await import('../server/utils/release-timeline-graphql-utils');
import type { FollowedRepository } from '../shared/types/release-follows';

const follow = (id: string, name = `repo-${id}`): FollowedRepository => ({
  id,
  owner: 'octo',
  name,
});

describe('mapRepositoryReleaseLookup', () => {
  test('maps a GraphQL repository node into an available payload and drops drafts', () => {
    expect(
      mapRepositoryReleaseLookup({
        id: 'R_widgets',
        name: 'widgets',
        nameWithOwner: 'octo/widgets',
        owner: { login: 'octo' },
        releases: {
          pageInfo: { hasNextPage: true },
          nodes: [
            {
              databaseId: 11,
              url: 'https://github.com/octo/widgets/releases/tag/v1.1',
              tagName: 'v1.1',
              name: 'Widgets 1.1',
              description: 'Notes',
              publishedAt: '2026-08-22T12:00:00.000Z',
              isDraft: false,
              isPrerelease: true,
              releaseAssets: { totalCount: 3 },
              reactionGroups: [
                { content: 'THUMBS_UP', viewerHasReacted: true, reactors: { totalCount: 4 } },
                { content: 'ROCKET', viewerHasReacted: false, reactors: { totalCount: 1 } },
                { content: 'THUMBS_DOWN', viewerHasReacted: false, reactors: { totalCount: 2 } },
              ],
            },
            {
              databaseId: 10,
              tagName: 'v1.0-draft',
              name: 'Draft',
              description: null,
              publishedAt: '2026-08-21T12:00:00.000Z',
              isDraft: true,
              isPrerelease: false,
              releaseAssets: { totalCount: 0 },
            },
            {
              databaseId: null,
              tagName: 'skip-me',
              publishedAt: '2026-08-20T12:00:00.000Z',
            },
            null,
          ],
        },
      })
    ).toEqual({
      status: 'available',
      owner: 'octo',
      name: 'widgets',
      hasOlderReleases: true,
      endCursor: null,
      releases: [
        {
          id: 11,
          tagName: 'v1.1',
          name: 'Widgets 1.1',
          description: 'Notes',
          notesSearchText: 'notes',
          publishedAt: '2026-08-22T12:00:00.000Z',
          isDraft: false,
          isPrerelease: true,
          assetCount: 3,
          htmlUrl: 'https://github.com/octo/widgets/releases/tag/v1.1',
          reactions: [
            {
              content: '+1',
              count: 4,
              viewerHasReacted: true,
              viewerReactionId: null,
            },
            {
              content: 'rocket',
              count: 1,
              viewerHasReacted: false,
              viewerReactionId: null,
            },
          ],
        },
      ],
    });
  });

  test('treats a null node as an Unavailable Followed Repository', () => {
    expect(mapRepositoryReleaseLookup(null)).toEqual({ status: 'unavailable' });
  });
});

describe('mapRepositoryIdentityLookup', () => {
  test('maps a repository node to an available identity and a null node to Unavailable', () => {
    expect(
      mapRepositoryIdentityLookup({
        id: 'R_widgets',
        name: 'widgets-renamed',
        nameWithOwner: 'new-org/widgets-renamed',
        owner: { login: 'new-org' },
      })
    ).toEqual({
      status: 'available',
      owner: 'new-org',
      name: 'widgets-renamed',
    });
    expect(mapRepositoryIdentityLookup(null)).toEqual({ status: 'unavailable' });
  });

  test('prefers nameWithOwner when it differs from owner login and name', () => {
    expect(
      mapRepositoryIdentityLookup({
        id: 'R_moved',
        name: 'old-name',
        nameWithOwner: 'new-org/new-name',
        owner: { login: 'old-org' },
      })
    ).toEqual({
      status: 'available',
      owner: 'new-org',
      name: 'new-name',
    });
  });
});

describe('fetchFollowedRepositoryReleaseLookups', () => {
  test('requests 100 releases per connection and resumes independent cursors', async () => {
    const requests: { query: string; variables?: Record<string, unknown> }[] = [];
    const result = await fetchFollowedRepositoryReleaseLookups(
      {
        graphql: async (query, variables) => {
          requests.push({ query, variables });
          return {
            repo0: {
              id: 'A',
              releases: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'A2' } },
            },
            repo1: null,
          };
        },
      },
      [follow('A'), follow('B')],
      { cursors: { A: 'A1', B: 'B1' } }
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]!.query).toContain('first: 100');
    expect(requests[0]!.query).toContain('after: $after0');
    expect(requests[0]!.query).toContain('after: $after1');
    expect(requests[0]!.variables).toMatchObject({
      id0: 'A',
      after0: 'A1',
      id1: 'B',
      after1: 'B1',
    });
    expect(result.A).toMatchObject({
      status: 'available',
      endCursor: 'A2',
      hasOlderReleases: true,
    });
    expect(result.B).toEqual({ status: 'unavailable' });
  });

  test('does not call GitHub when there are no Followed Repositories', async () => {
    let called = false;

    const lookups = await fetchFollowedRepositoryReleaseLookups(
      {
        graphql: async () => {
          called = true;
          return { nodes: [] };
        },
      },
      []
    );

    expect(called).toBe(false);
    expect(lookups).toEqual({});
  });

  test('maps mixed node results in id order and marks a failed chunk as transient', async () => {
    const follows = [
      follow('R_live', 'live'),
      follow('R_gone', 'gone'),
      follow('R_flaky', 'flaky'),
    ];
    let calls = 0;

    const lookups = await fetchFollowedRepositoryReleaseLookups(
      {
        graphql: async (_query, variables) => {
          calls += 1;
          const ids = Object.entries(variables!)
            .filter(([name]) => name.startsWith('id'))
            .map(([, id]) => id as string);
          if (ids.includes('R_flaky') && ids.length === 1) {
            throw new Error('chunk failed');
          }

          const nodes = ids.map((id) => {
            if (id === 'R_gone') return null;
            if (id === 'R_live') {
              return {
                id: 'R_live',
                name: 'live',
                owner: { login: 'octo' },
                releases: {
                  pageInfo: { hasNextPage: false },
                  nodes: [
                    {
                      databaseId: 1,
                      tagName: 'v1',
                      name: 'Live',
                      publishedAt: '2026-08-22T12:00:00.000Z',
                      isDraft: false,
                      isPrerelease: false,
                      releaseAssets: { totalCount: 0 },
                    },
                  ],
                },
              };
            }
            return null;
          });
          return Object.fromEntries(nodes.map((node, index) => [`repo${index}`, node]));
        },
      },
      follows,
      { chunkSize: 2 }
    );

    expect(calls).toBe(2);
    expect(lookups.R_live?.status).toBe('available');
    expect(lookups.R_gone).toEqual({ status: 'unavailable' });
    expect(lookups.R_flaky).toEqual({ status: 'transient' });
  });
});

describe('fetchFollowedRepositoryIdentityLookups', () => {
  test('does not call GitHub when there are no Followed Repositories', async () => {
    let called = false;

    const lookups = await fetchFollowedRepositoryIdentityLookups(
      {
        graphql: async () => {
          called = true;
          return { nodes: [] };
        },
      },
      []
    );

    expect(called).toBe(false);
    expect(lookups).toEqual({});
  });

  test('classifies mixed identity nodes and a failed bulk lookup as transient', async () => {
    const follows = [
      follow('R_live', 'live'),
      follow('R_gone', 'gone'),
      follow('R_flaky', 'flaky'),
    ];

    const mixed = await fetchFollowedRepositoryIdentityLookups(
      {
        graphql: async (_query, variables) => ({
          nodes: (variables?.ids as string[]).map((id) => {
            if (id === 'R_gone') return null;
            if (id === 'R_live') {
              return {
                id: 'R_live',
                name: 'live-renamed',
                nameWithOwner: 'octo/live-renamed',
                owner: { login: 'octo' },
              };
            }
            return {
              id,
              name: 'flaky',
              nameWithOwner: 'octo/flaky',
              owner: { login: 'octo' },
            };
          }),
        }),
      },
      follows
    );

    expect(mixed.R_live).toEqual({
      status: 'available',
      owner: 'octo',
      name: 'live-renamed',
    });
    expect(mixed.R_gone).toEqual({ status: 'unavailable' });
    expect(mixed.R_flaky).toEqual({
      status: 'available',
      owner: 'octo',
      name: 'flaky',
    });

    const failed = await fetchFollowedRepositoryIdentityLookups(
      {
        graphql: async () => {
          throw new Error('bulk lookup failed');
        },
      },
      follows
    );

    expect(failed).toEqual({
      R_live: { status: 'transient' },
      R_gone: { status: 'transient' },
      R_flaky: { status: 'transient' },
    });
  });
});

test('a coordinated round spans bounded GraphQL chunks and preserves valid partial repository pages', async () => {
  const follows = Array.from({ length: 43 }, (_, index) => follow(`R${index}`));
  const counts: number[] = [];
  const result = await fetchFollowedRepositoryReleaseLookups(
    {
      graphql: async (_query, variables) => {
        const ids = Object.entries(variables!)
          .filter(([name]) => name.startsWith('id'))
          .map(([, id]) => id as string);
        counts.push(ids.length);
        const data = Object.fromEntries(
          ids.map((id, index) => [
            `repo${index}`,
            id === 'R1'
              ? null
              : { id, releases: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
          ])
        );
        if (ids.includes('R0')) throw { data, errors: [{ path: ['repo1'], type: 'RATE_LIMITED' }] };
        return data;
      },
    },
    follows,
    { cursors: Object.fromEntries(follows.map((repo) => [repo.id, null])) }
  );
  expect(counts).toEqual([20, 20, 3]);
  expect(Object.keys(result)).toHaveLength(43);
  expect(result.R0?.status).toBe('available');
  expect(result.R1?.status).toBe('transient');
  expect(result.R42?.status).toBe('available');
});

test('optional nested GraphQL errors preserve usable cards and connection progress', async () => {
  const result = await fetchFollowedRepositoryReleaseLookups(
    {
      graphql: async () => {
        throw {
          data: {
            repo0: {
              id: 'A',
              releases: {
                nodes: [
                  {
                    databaseId: 1,
                    tagName: 'v1',
                    publishedAt: '2026-10-10T00:00:00Z',
                    reactionGroups: null,
                  },
                ],
                pageInfo: { hasNextPage: true, endCursor: 'next' },
              },
            },
          },
          errors: [{ path: ['repo0', 'releases', 'nodes', 0, 'reactionGroups'], type: 'INTERNAL' }],
        };
      },
    },
    [follow('A')],
    { cursors: { A: null } }
  );
  expect(result.A).toMatchObject({ status: 'available', endCursor: 'next', releases: [{ id: 1 }] });
});

test('missing release nodes retain valid siblings but mark the page incomplete for retry', async () => {
  const result = await fetchFollowedRepositoryReleaseLookups(
    {
      graphql: async () => {
        throw {
          data: {
            repo0: {
              id: 'A',
              releases: {
                nodes: [
                  { databaseId: 1, tagName: 'v1', publishedAt: '2026-10-10T00:00:00Z' },
                  null,
                ],
                pageInfo: { hasNextPage: true, endCursor: 'next' },
              },
            },
          },
          errors: [{ path: ['repo0', 'releases', 'nodes', 1], type: 'INTERNAL' }],
        };
      },
    },
    [follow('A')],
    { cursors: { A: null } }
  );
  expect(result.A).toMatchObject({ status: 'available', incomplete: true, releases: [{ id: 1 }] });
});
