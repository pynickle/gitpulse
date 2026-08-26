import { describe, expect, mock, test } from 'bun:test';

import * as linkedPullRequests from '../shared/utils/linked-pull-requests';

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);

const { default: getNotificationLinkedPullRequestListSummary } =
  await import('../app/utils/getNotificationLinkedPullRequestListSummary');

describe('Notification Linked Pull Request Count presentation', () => {
  test('hides Count while enrichment is pending, failed, or not an Issue', () => {
    expect(
      getNotificationLinkedPullRequestListSummary({
        type: 'Issue',
        stateStatus: 'pending',
        linkedPullRequestCount: 2,
      })
    ).toBeNull();
    expect(
      getNotificationLinkedPullRequestListSummary({
        type: 'Issue',
        stateStatus: 'error',
        linkedPullRequestCount: 2,
      })
    ).toBeNull();
    expect(
      getNotificationLinkedPullRequestListSummary({
        type: 'PullRequest',
        stateStatus: 'loaded',
        linkedPullRequestCount: 2,
      })
    ).toBeNull();
    expect(
      getNotificationLinkedPullRequestListSummary({
        type: 'Discussion',
        stateStatus: 'loaded',
        linkedPullRequestCount: 1,
      })
    ).toBeNull();
  });

  test('shows Count after Issue enrichment loads', () => {
    expect(
      getNotificationLinkedPullRequestListSummary({
        type: 'Issue',
        stateStatus: 'loaded',
        linkedPullRequestCount: 1,
        linkedPullRequest: { owner: 'acme', repo: 'widgets', number: 9 },
      })
    ).toEqual({
      count: 1,
      identity: { owner: 'acme', repo: 'widgets', number: 9 },
    });
  });
});
