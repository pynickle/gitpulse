import type {
  NotificationLabel,
  NotificationSubjectKind,
  NotificationSubjectState,
} from '#shared/types/notifications';

import parseGitHubRepoPath from './parseGitHubRepoPath';

interface DashboardIssuePrLabel {
  id?: number | string;
  name: string;
  color: string;
}

interface DashboardIssuePrUser {
  login?: string | null;
  avatar_url?: string | null;
}

interface DashboardIssuePrPullRequest {
  merged_at?: string | null;
}

export interface DashboardIssuePrEntity {
  id: PropertyKey;
  title?: string;
  repository_url?: string | null;
  number?: number | null;
  updated_at?: string;
  state?: NotificationSubjectState;
  draft?: boolean;
  merged_at?: string | null;
  pull_request?: DashboardIssuePrPullRequest | unknown;
  user?: DashboardIssuePrUser | null;
  labels?: DashboardIssuePrLabel[];
  [key: string]: unknown;
}

export interface DashboardIssuePrCard {
  id: PropertyKey;
  title: string;
  number: number | null;
  repositoryName: string;
  updatedAt: string | undefined;
  subjectType: NotificationSubjectKind;
  state: NotificationSubjectState;
  /** True when the PR is an open draft (ignored for issues / closed / merged). */
  draft: boolean;
  actorLogin: string;
  actorAvatarUrl: string;
  labels: NotificationLabel[];
}

const getRepositoryName = (repositoryUrl: string | null | undefined) => {
  if (!repositoryUrl) return '';

  return parseGitHubRepoPath(repositoryUrl)?.fullName ?? '';
};

const getPullRequestMergedAt = (entity: DashboardIssuePrEntity) => {
  if (entity.merged_at) return entity.merged_at;
  if (typeof entity.pull_request !== 'object' || entity.pull_request === null) return null;

  const mergedAt = (entity.pull_request as DashboardIssuePrPullRequest).merged_at;
  return typeof mergedAt === 'string' && mergedAt.length > 0 ? mergedAt : null;
};

export default function toDashboardIssuePrCard(
  entity: DashboardIssuePrEntity
): DashboardIssuePrCard {
  const isPullRequest = typeof entity.pull_request === 'object' && entity.pull_request !== null;
  const mergedAt = isPullRequest ? getPullRequestMergedAt(entity) : null;
  const state: NotificationSubjectState = mergedAt ? 'merged' : (entity.state ?? 'closed');

  return {
    id: entity.id,
    title: entity.title ?? '',
    number: entity.number ?? null,
    repositoryName: getRepositoryName(entity.repository_url),
    updatedAt: entity.updated_at,
    subjectType: isPullRequest ? 'PullRequest' : 'Issue',
    state,
    draft: isPullRequest && state === 'open' && Boolean(entity.draft),
    actorLogin: entity.user?.login ?? '',
    actorAvatarUrl: entity.user?.avatar_url ?? '',
    labels: (entity.labels ?? []).map((label) => ({
      name: label.name,
      color: label.color,
    })),
  };
}
