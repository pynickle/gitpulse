import type { DashboardNotificationSubject } from '#shared/types/notifications';

export default function getNotificationSubjectEnrichmentPresentation(
  subject?: DashboardNotificationSubject
) {
  const isPending = subject?.stateStatus === 'pending';
  const isError = subject?.stateStatus === 'error';
  const avatarMode = subject?.authorAvatarUrl
    ? ('avatar' as const)
    : isPending
      ? ('loading' as const)
      : isError
        ? ('error' as const)
        : ('static' as const);

  return {
    avatarMode,
    isPending,
    isError,
    animatesSubjectBadge: isPending,
    showsFailureMessage: isError,
  };
}
