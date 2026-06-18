import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  DASHBOARD_NOTIFICATION_SUBJECT_TYPES,
  getDashboardDiscussionStateVisual,
  getDashboardSubjectTypeVisual,
} from '../app/utils/getDashboardSubjectStateVisual';
import shouldShowNotificationSubjectNumber from '../app/utils/shouldShowNotificationSubjectNumber';

describe('dashboard notification item subject number display', () => {
  test('hides release ids from notification metadata', () => {
    expect(shouldShowNotificationSubjectNumber({ type: 'Release', number: 123456 })).toBe(false);
  });

  test('keeps user-facing numbers for issue-like notification subjects', () => {
    expect(shouldShowNotificationSubjectNumber({ type: 'Issue', number: 42 })).toBe(true);
    expect(shouldShowNotificationSubjectNumber({ type: 'PullRequest', number: 7 })).toBe(true);
    expect(shouldShowNotificationSubjectNumber({ type: 'Discussion', number: 3 })).toBe(true);
  });

  test('does not render the number slot directly from subject.number', () => {
    const notificationItemSource = readFileSync(
      'app/components/dashboard/NotificationItem.vue',
      'utf8'
    );

    expect(notificationItemSource).toContain('v-if="showSubjectNumber"');
    expect(notificationItemSource).toContain('shouldShowNotificationSubjectNumber(subject.value)');
    expect(notificationItemSource).not.toContain('v-if="currentNotification.subject?.number"');
  });

  test('keeps todo action as an icon-only action in the right action column', () => {
    const notificationItemSource = readFileSync(
      'app/components/dashboard/NotificationItem.vue',
      'utf8'
    );

    expect(notificationItemSource).toContain('notification-card__action-column');
    expect(notificationItemSource).toContain('notification-card__todo-btn');
    expect(notificationItemSource).toContain('notification-card__reason-control--action');
    expect(notificationItemSource).toContain('notification-card__reason-read-hint');
    expect(notificationItemSource).not.toContain('mark-read-btn');
    expect(notificationItemSource).not.toContain('todoActionLabel');
  });

  test('exposes icon-backed notification subject type filter options', () => {
    expect(DASHBOARD_NOTIFICATION_SUBJECT_TYPES.map((type) => type.value)).toEqual([
      'Issue',
      'PullRequest',
      'Discussion',
      'Release',
      'Commit',
      'CheckSuite',
      'RepositoryVulnerabilityAlert',
      'WorkflowRun',
      'RepositoryInvitation',
    ]);

    for (const subjectType of DASHBOARD_NOTIFICATION_SUBJECT_TYPES) {
      expect(getDashboardSubjectTypeVisual(subjectType.value).icon).toBeDefined();
    }
  });

  test('uses detail-aligned discussion visual states for notification badges', () => {
    expect(getDashboardDiscussionStateVisual(true)).toMatchObject({
      label: 'Answered discussion',
      state: 'discussion-answered',
      color: 'var(--gitpulse-success)',
    });
    expect(getDashboardDiscussionStateVisual(false)).toMatchObject({
      label: 'Unanswered discussion',
      state: 'discussion-unanswered',
      color: 'var(--gitpulse-text-strong)',
    });
  });
});
