import type { DashboardNotificationSubject } from '#shared/types/notifications';

type NotificationSubjectNumberCandidate = Pick<DashboardNotificationSubject, 'number' | 'type'>;

export default function shouldShowNotificationSubjectNumber(
  subject?: NotificationSubjectNumberCandidate | null
) {
  if (!subject?.number) {
    return false;
  }

  return subject.type !== 'Release';
}
