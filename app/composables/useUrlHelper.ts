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
  type: 'issues' | 'pulls';
  number: number;
  isIssue: boolean;
  isPR: boolean;
}

function isIssueOrPullSubject(notification: NotificationLike) {
  return notification.subject?.type === 'Issue' || notification.subject?.type === 'PullRequest';
}

export function useUrlHelper() {
  const getNotificationDetails = (notification: NotificationLike): NotificationDetails | null => {
    if (isIssueOrPullSubject(notification)) {
      const target = parseGitHubNotificationSubjectTarget(notification.subject);
      if (!target) return null;

      return {
        owner: target.owner,
        repo: target.repo,
        type: target.type,
        number: target.number,
        isIssue: target.type === 'issues',
        isPR: target.type === 'pulls',
      };
    }

    return null;
  };

  const openExternalNotification = (notification: NotificationLike) => {
    if (isIssueOrPullSubject(notification)) {
      const details = getNotificationDetails(notification);
      if (!details) return;

      window.open(
        `https://github.com/${details.owner}/${details.repo}/${details.type}/${details.number}`,
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
