import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

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
    expect(notificationItemSource).toContain(
      'shouldShowNotificationSubjectNumber(currentNotification.value.subject)'
    );
    expect(notificationItemSource).not.toContain('v-if="currentNotification.subject?.number"');
  });
});
