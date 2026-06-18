import type { NotificationSubjectStateTarget } from '#shared/types/notifications';

import { isGitHubApiHost, parseUrl } from './githubUrlUtils';
import parseGitHubMarkdownTarget, { type GitHubMarkdownTarget } from './parseGitHubMarkdownTarget';

export interface GitHubNotificationSubjectTarget {
  owner: string;
  repo: string;
  number: number;
  type: 'issues' | 'pulls' | 'discussions' | 'releases';
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

function parseGitHubReleaseSubjectUrl(url?: string | null): GitHubNotificationSubjectTarget | null {
  if (!url) return null;

  const parsedUrl = parseUrl(url);
  if (!parsedUrl || !isGitHubApiHost(parsedUrl.hostname)) return null;

  const [reposSegment, owner, repo, releasesSegment, releaseIdSegment] = parsedUrl.pathname
    .split('/')
    .filter(Boolean);

  if (reposSegment !== 'repos' || !owner || !repo || releasesSegment !== 'releases') {
    return null;
  }

  if (!releaseIdSegment || !/^\d+$/.test(releaseIdSegment)) {
    return null;
  }

  const number = Number.parseInt(releaseIdSegment, 10);
  if (!Number.isSafeInteger(number) || number < 1) return null;

  return {
    owner,
    repo,
    number,
    type: 'releases',
  };
}

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
  if (target.type === 'releases') {
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
  if (subject?.type === 'Release') {
    return parseGitHubReleaseSubjectUrl(subject.url);
  }

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
