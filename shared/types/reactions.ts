export type ReactionContent =
  | '+1'
  | '-1'
  | 'laugh'
  | 'confused'
  | 'heart'
  | 'hooray'
  | 'rocket'
  | 'eyes';

export type ReactionTargetKind = 'issue' | 'issue-comment' | 'pull-review-comment' | 'release';

export interface ReactionAuthor {
  login?: string;
  avatar_url?: string;
}

export interface GitHubReaction {
  id: number;
  content: ReactionContent;
  user?: ReactionAuthor | null;
  created_at?: string;
}

export interface ReactionSummaryItem {
  content: ReactionContent;
  count: number;
  viewerHasReacted: boolean;
  viewerReactionId: number | null;
}

export interface ReactionSummaryPayload {
  items: ReactionSummaryItem[];
}

export interface GraphQLReactionGroup {
  content?: string | null;
  viewerHasReacted?: boolean | null;
  reactors?: { totalCount?: number | null } | null;
}
