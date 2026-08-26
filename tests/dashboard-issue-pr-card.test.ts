import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import * as linkedPullRequests from '../shared/utils/linked-pull-requests';

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);

import type { DashboardIssuePrEntity } from '../app/utils/dashboardIssuePrCard';
import resolveIssueTypeColor from '../app/utils/issueTypeColor';

const { default: toDashboardIssuePrCard } = await import('../app/utils/dashboardIssuePrCard');

describe('dashboard issue/PR notification-style cards', () => {
  test('maps an open issue into the notification-style card view model', () => {
    const issue: DashboardIssuePrEntity = {
      id: 101,
      title: 'Fix keyboard focus on dashboard tabs',
      repository_url: 'https://api.github.com/repos/owner/repo',
      number: 42,
      updated_at: '2026-06-09T09:30:00Z',
      state: 'open',
      comments: 1,
      user: {
        login: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      },
      labels: [
        { id: 1, name: 'bug', color: 'd1242f' },
        { id: 2, name: 'accessibility', color: '0969da' },
      ],
      type: {
        id: 5,
        node_id: 'IT_kwDOExample',
        name: 'Bug',
        description: 'Unexpected behavior or an error',
        color: 'red',
      },
    };

    expect(toDashboardIssuePrCard(issue)).toEqual({
      id: 101,
      title: 'Fix keyboard focus on dashboard tabs',
      number: 42,
      repositoryName: 'owner/repo',
      updatedAt: '2026-06-09T09:30:00Z',
      subjectType: 'Issue',
      state: 'open',
      draft: false,
      comments: 1,
      linkedPullRequestCount: null,
      linkedPullRequest: null,
      actorLogin: 'octocat',
      actorAvatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
      issueType: { name: 'Bug', color: 'red' },
      labels: [
        { name: 'bug', color: 'd1242f' },
        { name: 'accessibility', color: '0969da' },
      ],
    });
  });

  test('maps merged pull requests to merged PullRequest subject state', () => {
    const pull: DashboardIssuePrEntity = {
      id: 'PR_7',
      title: 'Ship notification card layout for pull requests',
      repository_url: 'https://api.github.com/repos/acme/widgets',
      number: 7,
      updated_at: '2026-06-08T18:45:00Z',
      state: 'closed',
      merged_at: '2026-06-09T08:00:00Z',
      pull_request: {},
      user: {
        login: 'merge-bot',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      labels: [{ id: 'enhancement', name: 'enhancement', color: '2ea44f' }],
      type: {
        id: 6,
        node_id: 'IT_kwDOIgnored',
        name: 'Task',
        description: null,
        color: 'blue',
      },
    };

    expect(toDashboardIssuePrCard(pull)).toEqual({
      id: 'PR_7',
      title: 'Ship notification card layout for pull requests',
      number: 7,
      repositoryName: 'acme/widgets',
      updatedAt: '2026-06-08T18:45:00Z',
      subjectType: 'PullRequest',
      state: 'merged',
      draft: false,
      comments: null,
      linkedPullRequestCount: null,
      linkedPullRequest: null,
      actorLogin: 'merge-bot',
      actorAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      issueType: null,
      labels: [{ name: 'enhancement', color: '2ea44f' }],
    });
  });

  test('maps open draft pull requests with draft flag', () => {
    const pull: DashboardIssuePrEntity = {
      id: 'PR_9',
      title: 'WIP draft',
      repository_url: 'https://api.github.com/repos/acme/widgets',
      number: 9,
      state: 'open',
      draft: true,
      pull_request: {},
    };

    expect(toDashboardIssuePrCard(pull)).toMatchObject({
      subjectType: 'PullRequest',
      state: 'open',
      draft: true,
    });
  });

  test('maps search API pull_request merged_at to merged PullRequest subject state', () => {
    const pull: DashboardIssuePrEntity = {
      id: 'PR_8',
      title: 'Render merged search result correctly',
      repository_url: 'https://api.github.com/repos/acme/widgets',
      number: 8,
      updated_at: '2026-06-10T12:00:00Z',
      state: 'closed',
      pull_request: {
        merged_at: '2026-06-10T13:00:00Z',
      },
      user: {
        login: 'merge-bot',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      labels: [],
    };

    expect(toDashboardIssuePrCard(pull).state).toBe('merged');
  });

  test('handles malformed issue URLs without throwing', () => {
    const issue: DashboardIssuePrEntity = {
      id: 404,
      title: 'Unknown repository issue',
      repository_url: 'not a github repository url',
      number: null,
      updated_at: undefined,
      state: undefined,
      user: null,
      labels: undefined,
    };

    expect(toDashboardIssuePrCard(issue)).toEqual({
      id: 404,
      title: 'Unknown repository issue',
      number: null,
      repositoryName: '',
      updatedAt: undefined,
      subjectType: 'Issue',
      state: 'closed',
      draft: false,
      comments: null,
      linkedPullRequestCount: null,
      linkedPullRequest: null,
      actorLogin: '',
      actorAvatarUrl: '',
      issueType: null,
      labels: [],
    });
  });

  test('maps Linked Pull Request Count onto Issue cards and never onto pull request cards', () => {
    expect(
      toDashboardIssuePrCard({
        id: 11,
        title: 'Has linked pull requests',
        repository_url: 'https://api.github.com/repos/acme/widgets',
        number: 11,
        linkedPullRequestCount: 1,
        linkedPullRequest: { owner: 'acme', repo: 'widgets', number: 22 },
      })
    ).toMatchObject({
      subjectType: 'Issue',
      linkedPullRequestCount: 1,
      linkedPullRequest: { owner: 'acme', repo: 'widgets', number: 22 },
    });

    expect(
      toDashboardIssuePrCard({
        id: 12,
        title: 'Several linked pull requests',
        repository_url: 'https://api.github.com/repos/acme/widgets',
        number: 12,
        linkedPullRequestCount: 3,
        linkedPullRequest: { owner: 'acme', repo: 'widgets', number: 1 },
      }).linkedPullRequest
    ).toBeNull();

    expect(
      toDashboardIssuePrCard({
        id: 13,
        title: 'Pull request',
        repository_url: 'https://api.github.com/repos/acme/widgets',
        number: 13,
        pull_request: {},
        linkedPullRequestCount: 2,
        linkedPullRequest: { owner: 'acme', repo: 'widgets', number: 1 },
      })
    ).toMatchObject({
      subjectType: 'PullRequest',
      linkedPullRequestCount: null,
      linkedPullRequest: null,
    });
  });

  test('maps zero and invalid comments counts safely', () => {
    expect(
      toDashboardIssuePrCard({
        id: 1,
        comments: 0,
      }).comments
    ).toBe(0);

    expect(
      toDashboardIssuePrCard({
        id: 2,
        comments: -3,
      }).comments
    ).toBe(null);

    expect(
      toDashboardIssuePrCard({
        id: 3,
        comments: Number.NaN,
      }).comments
    ).toBe(null);
  });

  test('keeps issue and PR card UI aligned with notification item structure', () => {
    const issuePrCardSource = readFileSync(
      'app/components/dashboard/IssuePrNotificationItem.vue',
      'utf8'
    );
    const dashboardSource = readFileSync('app/pages/dashboard.vue', 'utf8');

    expect(issuePrCardSource).toContain('<GitHubAvatar');
    expect(issuePrCardSource).toContain('class="notification-type-badge"');
    expect(issuePrCardSource).toContain('notification-card__comments');
    expect(issuePrCardSource).toContain('MessageSquareIcon');
    expect(issuePrCardSource).not.toContain('notification-card__actions');
    expect(issuePrCardSource).not.toContain('notification-card__reason-slot');
    expect(dashboardSource).not.toContain('AsyncSearchItem');
    expect(dashboardSource).not.toContain("import('~/components/dashboard/SearchItem.vue')");
    expect(dashboardSource).toContain('<AsyncGenericSearchItem');
    expect(dashboardSource).toMatch(
      /<AsyncIssuePrNotificationItem\s+v-if="[\s\S]*selectedCustomTab\.query\.endpoint === 'issues'/
    );
    expect(dashboardSource).toMatch(/<AsyncIssuePrNotificationItem[\s\S]*:item="issue"/);
    expect(dashboardSource).toContain('<AsyncIssuePrNotificationItem :item="pull" />');
  });

  test('resolves GitHub issue type colors and safely falls back to gray', () => {
    expect(resolveIssueTypeColor('red')).toBe('#cf222e');
    expect(resolveIssueTypeColor(' #AABBCC ')).toBe('#aabbcc');
    expect(resolveIssueTypeColor('not-a-color')).toBe('#6e7781');
    expect(resolveIssueTypeColor(null)).toBe('#6e7781');
  });
});
