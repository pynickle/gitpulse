import type { LinkedPullRequestListSummary } from '#shared/types/linked-pull-requests';
import type { DashboardNotificationSubject } from '#shared/types/notifications';
import { readLinkedPullRequestListSummary } from '#shared/utils/linked-pull-requests';

/** List-stage summary for a Notification Issue after enrichment has loaded. */
export default function getNotificationLinkedPullRequestListSummary(
  subject?: DashboardNotificationSubject
): LinkedPullRequestListSummary | null {
  if (subject?.type !== 'Issue' || subject.stateStatus !== 'loaded') {
    return null;
  }

  return readLinkedPullRequestListSummary(
    subject.linkedPullRequestCount,
    subject.linkedPullRequest
  );
}
