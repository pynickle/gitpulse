import { describe, expect, mock, test } from 'bun:test';

import type { Octokit } from '@octokit/core';
import { createError } from 'h3';
Object.assign(globalThis, { createError });

const access = (eligible = true, pending = false) => ({
  repository: {
    pullRequest: {
      state: 'OPEN',
      suggestedReviewerActors: {
        nodes: eligible
          ? [{ reviewer: { __typename: 'Bot', login: 'copilot-pull-request-reviewer' } }]
          : [],
      },
      reviewRequests: {
        nodes: pending
          ? [{ requestedReviewer: { __typename: 'Bot', login: 'copilot-pull-request-reviewer' } }]
          : [],
      },
    },
  },
});

const reactions = await import('../shared/utils/reactions');
mock.module('#shared/utils/reactions', () => reactions);
mock.module('#shared/utils/copilot-review', () => import('../shared/utils/copilot-review'));
mock.module('#shared/types/comment-moderation', () => import('../shared/types/comment-moderation'));
const timelineUtils = await import('../server/utils/github-timeline-utils');
mock.module('#server/utils/github-timeline-utils', () => timelineUtils);
mock.module(
  '#server/utils/zod-validation-utils',
  () => import('../server/utils/zod-validation-utils')
);

const { fetchPRReviewerSummary, fetchReviewerCandidates, requestPRReviewers } =
  await import('../server/utils/pr-reviewers-utils');

function client({
  users = [],
  reviews = [],
  comments = [],
  organization = false,
  metadata = [],
}: {
  users?: Record<string, unknown>[];
  reviews?: Record<string, unknown>[];
  comments?: Record<string, unknown>[];
  organization?: boolean;
  metadata?: Record<string, unknown>[];
} = {}) {
  return {
    request: mock(async (route: string) => {
      if (route.endsWith('/copilot/code-review/settings'))
        return { data: { available_review_efforts: ['lite', 'balanced', 'max'] } };
      if (route.endsWith('/requested_reviewers')) return { data: { users, teams: [] } };
      if (route.endsWith('/reviews')) return { data: reviews };
      if (route.endsWith('/comments')) return { data: comments };
      if (route.endsWith('/collaborators')) return { data: [{ id: 1, login: 'reviewer' }] };
      throw new Error(`Unexpected route: ${route}`);
    }),
    graphql: mock(async (query: string) => {
      if (query.includes('CopilotReviewAccess')) return access();
      if (query.includes('PullRequestReviewMetadata')) {
        return {
          repository: {
            pullRequest: { reviews: { nodes: metadata, pageInfo: { hasNextPage: false } } },
          },
        };
      }
      if (!organization && query.includes('organization(login:')) {
        throw new Error("Could not resolve to an Organization with the login of 'pynickle'.");
      }
      return {
        repository: {
          owner: organization
            ? {
                teams: {
                  nodes: [
                    {
                      id: 'team-node',
                      databaseId: 2,
                      combinedSlug: 'pynickle/maintainers',
                      name: 'Maintainers',
                      repositories: { nodes: [{ nameWithOwner: 'pynickle/Better-Client' }] },
                    },
                  ],
                },
              }
            : { __typename: 'User' },
        },
      };
    }),
  } as unknown as Octokit;
}

describe('reviewer candidates', () => {
  test('ordinary reviewers still load when the optional Copilot availability check fails', async () => {
    const octokit = client();
    const graphql = octokit.graphql.bind(octokit);
    octokit.graphql = (async (query: string, variables: Record<string, unknown>) => {
      if (query.includes('CopilotReviewAccess')) throw new Error('Copilot availability failed');
      return graphql(query, variables);
    }) as Octokit['graphql'];
    const candidates = await fetchReviewerCandidates(octokit, 'pynickle', 'Better-Client', 19);
    expect(candidates.users.map((item) => item.login)).toEqual(['reviewer']);
    expect(candidates.canRequestCopilot).toBe(false);
    expect(candidates.warnings).toEqual([
      { source: 'copilot', message: 'Copilot availability failed' },
    ]);
  });

  test('a pending Copilot bot alias is already requested in the picker', async () => {
    const candidates = await fetchReviewerCandidates(
      client({ users: [{ id: 175728472, login: 'copilot-pull-request-reviewer[bot]' }] }),
      'pynickle',
      'Better-Client',
      19
    );
    expect(candidates.users.find((item) => item.login === 'Copilot')?.requested).toBe(true);
  });
  test('keeps Copilot available when collaborator and administration access are denied', async () => {
    const octokit = client();
    const request = octokit.request.bind(octokit);
    octokit.request = (async (route: string, parameters: Record<string, unknown>) => {
      if (route.endsWith('/collaborators') || route.endsWith('/copilot/code-review/settings')) {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      }
      return request(route, parameters);
    }) as Octokit['request'];
    const candidates = await fetchReviewerCandidates(octokit, 'pynickle', 'Better-Client', 19);
    expect(candidates.canRequestReviewers).toBe(false);
    expect(candidates.items).toMatchObject([{ login: 'Copilot' }]);
    expect(candidates.warnings).toEqual([]);
  });
  test('offers Copilot as an explicit reviewer without needing a collaborator entry', async () => {
    const candidates = await fetchReviewerCandidates(client(), 'pynickle', 'Better-Client', 19);
    expect(candidates.users).toContainEqual(
      expect.objectContaining({ login: 'Copilot', requested: false })
    );
  });
  test('a personal repository offers users without an organization warning', async () => {
    const candidates = await fetchReviewerCandidates(client(), 'pynickle', 'Better-Client', 19);

    expect(candidates.warnings).toEqual([]);
    expect(candidates.users.map((item) => item.login)).toContain('reviewer');
    expect(candidates.teams).toEqual([]);
  });

  test('an organization repository still offers its repository teams', async () => {
    const candidates = await fetchReviewerCandidates(
      client({ organization: true }),
      'pynickle',
      'Better-Client',
      19
    );

    expect(candidates.warnings).toEqual([]);
    expect(candidates.teams).toMatchObject([{ slug: 'maintainers', name: 'Maintainers' }]);
  });
});

describe('request reviewers', () => {
  test('accepts the Copilot offer without requiring repository write access', async () => {
    const octokit = {
      graphql: async () => access(),
      request: mock(async () => ({ data: {} })),
    } as unknown as Octokit;
    await requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
      reviewers: ['Copilot'],
      teamReviewers: [],
    });
    expect(octokit.request).toHaveBeenCalled();
  });

  test('rejects a request before mutation when GitHub does not offer Copilot', async () => {
    const octokit = {
      graphql: async () => access(false),
      request: mock(async () => ({ data: {} })),
    } as unknown as Octokit;
    await expect(
      requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
        reviewers: ['Copilot'],
        teamReviewers: [],
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(octokit.request).not.toHaveBeenCalled();
  });

  test('another user pending request does not grant the current viewer eligibility', async () => {
    const octokit = {
      graphql: async () => access(false, true),
      request: mock(async () => ({ data: {} })),
    } as unknown as Octokit;
    await expect(
      requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
        reviewers: ['Copilot'],
        teamReviewers: [],
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(octokit.request).not.toHaveBeenCalled();
  });
  test('leaves default effort resolution to GitHub when no effort was selected', async () => {
    const octokit = {
      graphql: async () => access(),
      request: mock(async () => ({ data: { state: 'PENDING' } })),
    } as unknown as Octokit;
    await requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
      reviewers: ['Copilot'],
      teamReviewers: [],
    });
    expect(octokit.request).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/copilot-code-review',
      { owner: 'pynickle', repo: 'Better-Client', pull_number: 19 }
    );
  });

  test('keeps human and team reviewers on their ordinary API for a mixed selection', async () => {
    const pull = { number: 19 };
    const octokit = {
      graphql: async () => access(),
      request: mock(async () => ({ data: pull })),
    } as unknown as Octokit;
    const result = await requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
      reviewers: ['reviewer', 'Copilot'],
      teamReviewers: ['maintainers'],
      copilotReviewEffort: 'lite',
    });
    expect(result).toEqual(pull);
    expect(octokit.request).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
      {
        owner: 'pynickle',
        repo: 'Better-Client',
        pull_number: 19,
        reviewers: ['reviewer'],
        team_reviewers: ['maintainers'],
      }
    );
  });

  test('preserves GitHub permission and pending-request failures', async () => {
    for (const status of [403, 409, 422]) {
      const error = Object.assign(new Error('GitHub rejected this review request'), { status });
      const octokit = {
        graphql: async () => access(),
        request: async () => {
          throw error;
        },
      } as unknown as Octokit;
      await expect(
        requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
          reviewers: ['Copilot'],
          teamReviewers: [],
        })
      ).rejects.toBe(error);
    }
  });

  test('requests Copilot with the chosen effort through its dedicated GitHub API', async () => {
    const requests: Array<{ route: string; body: Record<string, unknown> }> = [];
    const octokit = {
      graphql: async () => access(),
      request: async (route: string, body: Record<string, unknown>) => {
        requests.push({ route, body });
        return { data: { state: 'PENDING' } };
      },
    } as unknown as Octokit;
    const pullRequest = await requestPRReviewers(octokit, 'pynickle', 'Better-Client', 19, {
      reviewers: ['Copilot'],
      teamReviewers: [],
      copilotReviewEffort: 'max',
    });
    expect(pullRequest).toBeUndefined();
    expect(requests).toEqual([
      {
        route: 'POST /repos/{owner}/{repo}/pulls/{pull_number}/copilot-code-review',
        body: { owner: 'pynickle', repo: 'Better-Client', pull_number: 19, review_effort: 'max' },
      },
    ]);
  });
});

describe('reviewer identity', () => {
  test('shows the last Copilot review effort returned by GitHub', async () => {
    const summary = await fetchPRReviewerSummary(
      client({
        reviews: [
          {
            id: 10,
            user: { id: 175728472, login: 'Copilot' },
            state: 'COMMENTED',
            submitted_at: '2026-11-11T03:00:00Z',
          },
        ],
        metadata: [
          { databaseId: 10, isCopilotCodeReview: true, copilotCodeReviewEffort: 'BALANCED' },
        ],
      }),
      'pynickle',
      'Better-Client',
      19
    );
    expect(summary.items[0]?.copilotReviewEffort).toBe('balanced');
  });
  test('merges Copilot requests, submitted reviews and comments into one reviewer', async () => {
    const identity = { id: 175728472, node_id: 'BOT_kgDOCnlnWA' };
    const bot = { ...identity, login: 'copilot-pull-request-reviewer[bot]' };
    const summary = await fetchPRReviewerSummary(
      client({
        users: [{ ...identity, login: 'Copilot' }],
        reviews: [{ id: 10, user: bot, state: 'COMMENTED', submitted_at: '2026-11-11T03:00:00Z' }],
        comments: [{ user: bot, created_at: '2026-11-11T03:00:00Z' }],
      }),
      'pynickle',
      'Better-Client',
      19
    );

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({
      name: 'Copilot',
      login: 'Copilot',
      requested: true,
      status: 'requested',
      reviewCount: 1,
      commentCount: 1,
    });
    expect(summary.counts.total).toBe(1);
  });

  test('retains Copilot presentation after a request has completed', async () => {
    const summary = await fetchPRReviewerSummary(
      client({
        reviews: [
          {
            id: 10,
            user: { id: 175728472, login: 'copilot-pull-request-reviewer[bot]' },
            state: 'COMMENTED',
            submitted_at: '2026-11-11T03:00:00Z',
          },
        ],
      }),
      'pynickle',
      'Better-Client',
      19
    );

    expect(summary.items).toMatchObject([
      { name: 'Copilot', login: 'Copilot', status: 'commented' },
    ]);
  });

  test('merges an ordinary reviewer renamed between API responses and preserves its request key', async () => {
    const summary = await fetchPRReviewerSummary(
      client({
        users: [{ id: 1, login: 'new-name' }],
        reviews: [
          {
            id: 10,
            user: { id: 1, login: 'old-name' },
            state: 'APPROVED',
            submitted_at: '2026-11-11T03:00:00Z',
          },
        ],
      }),
      'pynickle',
      'Better-Client',
      19
    );

    expect(summary.items).toMatchObject([{ key: 'user:new-name', reviewCount: 1 }]);
    expect(summary.items).toHaveLength(1);
  });
});
