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

export function useUrlHelper() {
  const getNotificationDetails = (notification: NotificationLike): NotificationDetails | null => {
    if (notification.subject?.type === 'Issue' || notification.subject?.type === 'PullRequest') {
      const url = notification.subject.url;
      if (!url) return null;

      const match = url.match(/repos\/([^\/]+)\/([^\/]+)\/(issues|pulls)\/(\d+)/);
      if (match) {
        const [, owner, repo, type, number] = match;
        if (!owner || !repo || !number || (type !== 'issues' && type !== 'pulls')) {
          return null;
        }

        return {
          owner,
          repo,
          type,
          number: Number.parseInt(number, 10),
          isIssue: type === 'issues',
          isPR: type === 'pulls',
        };
      }
    }
    return null;
  };

  const openExternalNotification = (notification: NotificationLike) => {
    if (notification.subject?.type === 'Issue' || notification.subject?.type === 'PullRequest') {
      const url = notification.subject.url;
      if (!url) return;

      const match = url.match(/repos\/([^\/]+)\/([^\/]+)\/(issues|pulls)\/(\d+)/);
      if (match) {
        const [, owner, repo, type, number] = match;
        window.open(`https://github.com/${owner}/${repo}/${type}/${number}`, '_blank');
      }
    } else if (notification.html_url) {
      window.open(notification.html_url, '_blank');
    }
  };

  return {
    getNotificationDetails,
    openExternalNotification,
  };
}
