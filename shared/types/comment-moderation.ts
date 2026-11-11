export const COMMENT_HIDDEN_REASONS = [
  'ABUSE',
  'DUPLICATE',
  'LOW_QUALITY',
  'OFF_TOPIC',
  'OUTDATED',
  'RESOLVED',
  'SPAM',
] as const;

export type CommentHiddenReason = (typeof COMMENT_HIDDEN_REASONS)[number];
export type CommentResourceType =
  | 'IssueComment'
  | 'PullRequestReviewComment'
  | 'PullRequestReview'
  | 'CommitComment'
  | 'DiscussionComment';

/**
 * A review is reviewed history, not a comment: GitHub only deletes a pending
 * review, and GitPulse never shows one. Every delete entry point asks this first.
 */
export function isDeletableCommentResource(resourceType: CommentResourceType) {
  return resourceType !== 'PullRequestReview';
}

export interface CommentModeration {
  resourceType: CommentResourceType;
  nodeId: string;
  databaseId?: number;
  isMinimized: boolean;
  minimizedReason: string | null;
  viewerCanDelete: boolean;
  viewerCanMinimize: boolean;
  viewerCanUnminimize: boolean;
}

export interface CommentModerationResult {
  resourceType?: CommentResourceType;
  moderation: CommentModeration | null;
  deleted?: boolean;
  body?: string;
  discussion?: {
    id: string;
    isAnswered: boolean;
    answerId: string | null;
    totalCount: number;
    parentId?: string;
    replyCount?: number;
  };
}
