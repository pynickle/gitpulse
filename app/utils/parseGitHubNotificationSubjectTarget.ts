import type { NotificationSubjectStateTarget } from '#shared/types/notifications';

import parseGitHubMarkdownTarget, { type GitHubMarkdownTarget } from './parseGitHubMarkdownTarget';

export interface GitHubNotificationSubjectTarget {
  owner: string;
  repo: string;
  number: number;
  type: 'issues' | 'pulls' | 'discussions';
}

interface GitHubNotificationSubjectLike {
  type?: string;
  url?: string | null;
}

const getExpectedTargetType = (subjectType?: string): GitHubMarkdownTarget['type'] | null => {
  if (subjectType === 'Issue') return 'issue';
  if (subjectType === 'PullRequest') return 'pull-request';
  if (subjectType === 'Discussion') return 'discussion';
  return null;
};

const getRouteType = (
  targetType: GitHubMarkdownTarget['type']
): GitHubNotificationSubjectTarget['type'] => {
  if (targetType === 'issue') return 'issues';
  if (targetType === 'pull-request') return 'pulls';
  return 'discussions';
};

export function toNotificationSubjectStateTarget(
  target: GitHubNotificationSubjectTarget
): NotificationSubjectStateTarget | null {
  if (target.type !== 'issues' && target.type !== 'pulls') {
    return null;
  }

  return {
    key: `${target.owner}/${target.repo}/${target.type}/${target.number}`,
    owner: target.owner,
    repo: target.repo,
    type: target.type,
    number: target.number,
  };
}

export default function parseGitHubNotificationSubjectTarget(
  subject?: GitHubNotificationSubjectLike | null
): GitHubNotificationSubjectTarget | null {
  const expectedTargetType = getExpectedTargetType(subject?.type);
  if (!expectedTargetType) return null;

  const target = parseGitHubMarkdownTarget(subject?.url);
  if (!target || target.type !== expectedTargetType) return null;

  return {
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    type: getRouteType(target.type),
  };
}
