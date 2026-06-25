import {
  buildGitHubUrlFromDashboardTarget,
  createDashboardDiscussionTarget,
  createDashboardIssueTarget,
  createDashboardPullRequestTarget,
  createDashboardReleaseTarget,
  type DashboardUrlTarget,
} from '~/utils/dashboardUrlNavigationUtils';
import parseGitHubNotificationSubjectTarget from '~/utils/parseGitHubNotificationSubjectTarget';

interface NotificationSubject {
  type?: string;
  url?: string;
}

interface NotificationLike {
  subject?: NotificationSubject;
  html_url?: string;
}

interface NotificationDetails {
  owner: string;
  repo: string;
  type: 'issues' | 'pulls' | 'discussions' | 'releases';
  number: number;
  isIssue: boolean;
  isPR: boolean;
  isDiscussion: boolean;
  isRelease: boolean;
}

function isInternalDetailSubject(notification: NotificationLike) {
  return (
    notification.subject?.type === 'Issue' ||
    notification.subject?.type === 'PullRequest' ||
    notification.subject?.type === 'Discussion' ||
    notification.subject?.type === 'Release'
  );
}

export function useUrlHelper() {
  const getNotificationDetails = (notification: NotificationLike): NotificationDetails | null => {
    if (isInternalDetailSubject(notification)) {
      const target = parseGitHubNotificationSubjectTarget(notification.subject);
      if (!target) return null;

      return {
        owner: target.owner,
        repo: target.repo,
        type: target.type,
        number: target.number,
        isIssue: target.type === 'issues',
        isPR: target.type === 'pulls',
        isDiscussion: target.type === 'discussions',
        isRelease: target.type === 'releases',
      };
    }

    return null;
  };

  const openExternalNotification = (notification: NotificationLike) => {
    if (isInternalDetailSubject(notification)) {
      const details = getNotificationDetails(notification);
      if (!details) return;

      let target: DashboardUrlTarget;
      if (details.isIssue) {
        target = createDashboardIssueTarget(details.owner, details.repo, details.number);
      } else if (details.isDiscussion) {
        target = createDashboardDiscussionTarget(details.owner, details.repo, details.number);
      } else if (details.isRelease) {
        target = createDashboardReleaseTarget(details.owner, details.repo, {
          kind: 'id',
          id: details.number,
        });
      } else {
        target = createDashboardPullRequestTarget(details.owner, details.repo, details.number);
      }

      window.open(
        notification.html_url ?? buildGitHubUrlFromDashboardTarget(target),
        '_blank',
        'noopener'
      );
      return;
    }

    if (notification.html_url) {
      window.open(notification.html_url, '_blank', 'noopener');
    }
  };

  return {
    getNotificationDetails,
    openExternalNotification,
  };
}
