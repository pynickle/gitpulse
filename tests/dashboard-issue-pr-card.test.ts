import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import toDashboardIssuePrCard, {
  type DashboardIssuePrEntity,
} from '../app/utils/dashboardIssuePrCard';

describe('dashboard issue/PR notification-style cards', () => {
  test('maps an open issue into the notification-style card view model', () => {
    const issue: DashboardIssuePrEntity = {
      id: 101,
      title: 'Fix keyboard focus on dashboard tabs',
      repository_url: 'https://api.github.com/repos/owner/repo',
      number: 42,
      updated_at: '2026-06-09T09:30:00Z',
      state: 'open',
      user: {
        login: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      },
      labels: [
        { id: 1, name: 'bug', color: 'd1242f' },
        { id: 2, name: 'accessibility', color: '0969da' },
      ],
    };

    expect(toDashboardIssuePrCard(issue)).toEqual({
      id: 101,
      title: 'Fix keyboard focus on dashboard tabs',
      number: 42,
      repositoryName: 'owner/repo',
      updatedAt: '2026-06-09T09:30:00Z',
      subjectType: 'Issue',
      state: 'open',
      actorLogin: 'octocat',
      actorAvatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
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
    };

    expect(toDashboardIssuePrCard(pull)).toEqual({
      id: 'PR_7',
      title: 'Ship notification card layout for pull requests',
      number: 7,
      repositoryName: 'acme/widgets',
      updatedAt: '2026-06-08T18:45:00Z',
      subjectType: 'PullRequest',
      state: 'merged',
      actorLogin: 'merge-bot',
      actorAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      labels: [{ name: 'enhancement', color: '2ea44f' }],
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
      actorLogin: '',
      actorAvatarUrl: '',
      labels: [],
    });
  });

  test('keeps issue and PR card UI aligned with notification item structure', () => {
    const issuePrCardSource = readFileSync(
      'app/components/dashboard/IssuePrNotificationItem.vue',
      'utf8'
    );
    const dashboardSource = readFileSync('app/pages/dashboard.vue', 'utf8');

    expect(issuePrCardSource).toContain('<GitHubAvatar');
    expect(issuePrCardSource).toContain('class="notification-type-badge"');
    expect(issuePrCardSource).not.toContain('notification-card__actions');
    expect(issuePrCardSource).not.toContain('notification-card__reason-slot');
    expect(dashboardSource).toContain('<AsyncSearchItem');
    expect(dashboardSource).toContain('<AsyncGenericSearchItem');
    expect(dashboardSource).toContain('<AsyncIssuePrNotificationItem :item="issue" />');
    expect(dashboardSource).toContain('<AsyncIssuePrNotificationItem :item="pull" />');
  });
});
