import type { IssueTypeSummary } from './issues';
import type { LinkedPullRequestIdentity } from './linked-pull-requests';

export type NotificationSubjectKind = 'Issue' | 'PullRequest' | 'Discussion' | 'Release' | string;

export type NotificationSubjectState = 'open' | 'closed' | 'merged';

export type NotificationSubjectStateStatus = 'pending' | 'loaded' | 'error' | 'unavailable';

export interface NotificationLabel {
  name: string;
  color: string;
}

export interface DashboardNotificationSubject {
  title?: string;
  type?: NotificationSubjectKind;
  url?: string;
  number?: number;
  state?: NotificationSubjectState;
  /** Open draft PR — set by Notification Subject Enrichment (`isDraft` from GraphQL). */
  draft?: boolean;
  isAnswered?: boolean;
  stateStatus?: NotificationSubjectStateStatus;
  issueType?: IssueTypeSummary;
  labels?: NotificationLabel[];
  /** Issue/PR conversation comment count from Notification Subject Enrichment. */
  comments?: number;
  authorLogin?: string;
  authorAvatarUrl?: string;
  /** Linked Pull Request Count for Issues after Notification Subject Enrichment. */
  linkedPullRequestCount?: number;
  /** Present only when Linked Pull Request Count is 1 and routing identity is complete. */
  linkedPullRequest?: LinkedPullRequestIdentity;
}

export interface DashboardNotificationRepository {
  full_name?: string;
  url?: string;
  owner?: {
    avatar_url?: string;
    login?: string;
  };
}

export interface DashboardNotification {
  id: PropertyKey;
  subject?: DashboardNotificationSubject;
  repository?: DashboardNotificationRepository;
  unread?: boolean;
  updated_at?: string;
  reason?: string;
  html_url?: string;
  [key: string]: unknown;
}

export interface NotificationSubjectEnrichmentTarget {
  key: string;
  owner: string;
  repo: string;
  type: 'issues' | 'pulls' | 'discussions';
  number: number;
}

export interface NotificationSubjectEnrichmentResult {
  key: string;
  title?: string;
  updatedAt?: string;
  state?: NotificationSubjectState;
  /** Present for pull requests; true when GraphQL `isDraft` is true. */
  draft?: boolean;
  isAnswered?: boolean;
  issueType?: IssueTypeSummary;
  labels?: NotificationLabel[];
  /** Conversation comment count (`comments.totalCount`) for issues/PRs. */
  comments?: number;
  authorLogin?: string;
  authorAvatarUrl?: string;
  /** Linked Pull Request Count. Present on Issue results only. */
  linkedPullRequestCount?: number;
  /** Present only when Count is 1 and owner, repository, and number are all present. */
  linkedPullRequest?: LinkedPullRequestIdentity;
}
