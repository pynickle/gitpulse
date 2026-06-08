export interface DiscussionAuthor {
  login: string;
  avatarUrl?: string;
  url?: string;
}

export interface DiscussionCategory {
  id: string;
  name: string;
  emoji?: string;
  description?: string | null;
  isAnswerable: boolean;
  slug?: string;
}

export interface DiscussionPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface DiscussionReply {
  id: string;
  nodeId: string;
  body: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  author: DiscussionAuthor | null;
  isAnswer: boolean;
  replyToId: string | null;
}

export interface DiscussionRepliesPayload {
  items: DiscussionReply[];
  totalCount: number;
  pageInfo: DiscussionPageInfo;
}

export interface DiscussionComment extends DiscussionReply {
  replies: DiscussionRepliesPayload;
}

export interface DiscussionCommentsPayload {
  items: DiscussionComment[];
  totalCount: number;
  pageInfo: DiscussionPageInfo;
}

export interface DiscussionDetailPayload {
  id: string;
  nodeId: string;
  number: number;
  title: string;
  body: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  author: DiscussionAuthor | null;
  category: DiscussionCategory | null;
  isAnswered: boolean;
  answer: DiscussionReply | null;
  locked: boolean;
  comments: DiscussionCommentsPayload;
  owner: string;
  repo: string;
  repository_url: string;
}
