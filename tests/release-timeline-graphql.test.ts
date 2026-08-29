import { describe, expect, test } from 'bun:test';

import {
  fetchFollowedRepositoryIdentityLookups,
  fetchFollowedRepositoryReleaseLookups,
  mapRepositoryIdentityLookup,
  mapRepositoryReleaseLookup,
} from '../server/utils/release-timeline-graphql-utils';
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
      releases: [
        {
          id: 11,
          tagName: 'v1.1',
          name: 'Widgets 1.1',
          description: 'Notes',
          publishedAt: '2026-08-22T12:00:00.000Z',
          isDraft: false,
          isPrerelease: true,
          assetCount: 3,
          htmlUrl: 'https://github.com/octo/widgets/releases/tag/v1.1',
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
          const ids = variables?.ids as string[];
          if (ids.includes('R_flaky') && ids.length === 1) {
            throw new Error('chunk failed');
          }

          return {
            nodes: ids.map((id) => {
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
            }),
          };
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
