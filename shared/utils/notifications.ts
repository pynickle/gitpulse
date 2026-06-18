import type {
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '../types/notifications';

export function isNotificationSubjectStateResultLoaded(
  target: NotificationSubjectStateTarget,
  result: NotificationSubjectStateResult | undefined
) {
  if (!result) return false;

  if (target.type === 'discussions') {
    return Boolean(
      result.title ||
      result.updatedAt ||
      result.authorLogin ||
      result.authorAvatarUrl ||
      typeof result.isAnswered === 'boolean'
    );
  }

  return Boolean(result.state);
}
