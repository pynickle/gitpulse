import { describe, expect, mock, test } from 'bun:test';

let paginatedUsers: unknown[] = [];

mock.module('#server/utils/github-timeline-utils', () => ({
  fetchPaginatedArray: async () => paginatedUsers,
}));

const { fetchIssueAssigneeCandidates } = await import('../server/utils/issue-assignees-utils');

describe('issue assignee utilities', () => {
  test('maps repository assignees to sorted candidates with assigned state', async () => {
    paginatedUsers = [
      {
        id: 2,
        login: 'zebra',
        avatar_url: 'https://example.com/zebra.png',
      },
      {
        id: 1,
        login: 'Alice',
        avatar_url: 'https://example.com/alice.png',
      },
      {
        id: 3,
        login: '',
      },
    ];

    const candidates = await fetchIssueAssigneeCandidates(
      {} as never,
      'owner',
      'repo',
      [{ login: 'alice' }],
      ''
    );

    expect(candidates).toEqual({
      query: '',
      items: [
        {
          id: 1,
          node_id: undefined,
          login: 'Alice',
          avatar_url: 'https://example.com/alice.png',
          html_url: undefined,
          url: undefined,
          assigned: true,
        },
        {
          id: 2,
          node_id: undefined,
          login: 'zebra',
          avatar_url: 'https://example.com/zebra.png',
          html_url: undefined,
          url: undefined,
          assigned: false,
        },
      ],
    });
  });

  test('filters assignee candidates by login query', async () => {
    paginatedUsers = [{ login: 'alice' }, { login: 'bob' }];

    const candidates = await fetchIssueAssigneeCandidates({} as never, 'owner', 'repo', [], 'bo');

    expect(candidates.items.map((candidate) => candidate.login)).toEqual(['bob']);
  });
});
