import type { GitHubIssueType, IssueTypeSummary } from '#shared/types/issues';
import type { LinkedPullRequestIdentity } from '#shared/types/linked-pull-requests';
import type {
  NotificationLabel,
  NotificationSubjectKind,
  NotificationSubjectState,
} from '#shared/types/notifications';
import { readLinkedPullRequestListSummary } from '#shared/utils/linked-pull-requests';

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
  /** Issue comment count from GitHub Search/Issues APIs (not review comments). */
  comments?: number | null;
  /** Linked Pull Request Count attached after the Search GraphQL pass. */
  linkedPullRequestCount?: number | null;
  /** Present only when Count is 1 and routing identity is complete. */
  linkedPullRequest?: LinkedPullRequestIdentity | null;
  pull_request?: DashboardIssuePrPullRequest | unknown;
  user?: DashboardIssuePrUser | null;
  labels?: DashboardIssuePrLabel[];
  type?: GitHubIssueType | null;
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
  /** Issue comment count when provided by the list payload. */
  comments: number | null;
  /** Linked Pull Request Count when the list payload included it. Hidden when 0/null. */
  linkedPullRequestCount: number | null;
  linkedPullRequest: LinkedPullRequestIdentity | null;
  actorLogin: string;
  actorAvatarUrl: string;
  issueType: IssueTypeSummary | null;
  labels: NotificationLabel[];
}

const normalizeCommentsCount = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const count = Math.trunc(value);
  return count >= 0 ? count : null;
};

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
  const linkedSummary = isPullRequest
    ? null
    : readLinkedPullRequestListSummary(entity.linkedPullRequestCount, entity.linkedPullRequest);

  return {
    id: entity.id,
    title: entity.title ?? '',
    number: entity.number ?? null,
    repositoryName: getRepositoryName(entity.repository_url),
    updatedAt: entity.updated_at,
    subjectType: isPullRequest ? 'PullRequest' : 'Issue',
    state,
    draft: isPullRequest && state === 'open' && Boolean(entity.draft),
    comments: normalizeCommentsCount(entity.comments),
    linkedPullRequestCount: linkedSummary?.count ?? null,
    linkedPullRequest: linkedSummary?.identity ?? null,
    actorLogin: entity.user?.login ?? '',
    actorAvatarUrl: entity.user?.avatar_url ?? '',
    issueType:
      !isPullRequest && entity.type?.name
        ? { name: entity.type.name, color: entity.type.color ?? null }
        : null,
    labels: (entity.labels ?? []).map((label) => ({
      name: label.name,
      color: label.color,
    })),
  };
}
