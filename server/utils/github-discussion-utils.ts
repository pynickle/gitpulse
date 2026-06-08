import type { Octokit } from '@octokit/core';

import type {
  DiscussionAuthor,
  DiscussionCategory,
  DiscussionComment,
  DiscussionCommentsPayload,
  DiscussionDetailPayload,
  DiscussionPageInfo,
  DiscussionRepliesPayload,
  DiscussionReply,
} from '#shared/types/discussions';

type GitHubClient = Octokit;

const DISCUSSION_COMMENTS_PAGE_SIZE = 20;
const DISCUSSION_REPLIES_PAGE_SIZE = 20;
const INITIAL_REPLIES_PAGE_SIZE = 5;

interface DiscussionActorPayload {
  login?: string | null;
  avatarUrl?: string | null;
  url?: string | null;
}

interface DiscussionCategoryPayload {
  id?: string | null;
  name?: string | null;
  emoji?: string | null;
  description?: string | null;
  isAnswerable?: boolean | null;
  slug?: string | null;
}

interface DiscussionPageInfoPayload {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
}

interface DiscussionConnectionPayload<TNode> {
  totalCount?: number | null;
  nodes?: (TNode | null)[] | null;
  pageInfo?: DiscussionPageInfoPayload | null;
}

interface DiscussionReplyPayload {
  id?: string | null;
  body?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isAnswer?: boolean | null;
  author?: DiscussionActorPayload | null;
  replyTo?: {
    id?: string | null;
  } | null;
}

interface DiscussionCommentPayload extends DiscussionReplyPayload {
  replies?: DiscussionConnectionPayload<DiscussionReplyPayload> | null;
}

interface DiscussionRepositoryPayload {
  name?: string | null;
  owner?: {
    login?: string | null;
  } | null;
}

interface DiscussionParentPayload {
  id?: string | null;
  number?: number | null;
  repository?: DiscussionRepositoryPayload | null;
}

interface DiscussionPayload {
  id?: string | null;
  number?: number | null;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  locked?: boolean | null;
  isAnswered?: boolean | null;
  author?: DiscussionActorPayload | null;
  category?: DiscussionCategoryPayload | null;
  answer?: DiscussionReplyPayload | null;
  comments?: DiscussionConnectionPayload<DiscussionCommentPayload> | null;
}

interface FetchDiscussionResponse {
  repository?: {
    discussion?: DiscussionPayload | null;
  } | null;
}

interface FetchDiscussionCommentsResponse {
  repository?: {
    discussion?: {
      comments?: DiscussionConnectionPayload<DiscussionCommentPayload> | null;
    } | null;
  } | null;
}

interface FetchDiscussionCommentRepliesResponse {
  node?: {
    discussion?: DiscussionParentPayload | null;
    replyTo?: {
      id?: string | null;
    } | null;
    replies?: DiscussionConnectionPayload<DiscussionReplyPayload> | null;
  } | null;
}

interface FetchDiscussionNodeIdResponse {
  repository?: {
    discussion?: {
      id?: string | null;
    } | null;
  } | null;
}

interface FetchDiscussionReplyContextResponse {
  repository?: {
    discussion?: {
      id?: string | null;
    } | null;
  } | null;
  node?: {
    discussion?: DiscussionParentPayload | null;
    replyTo?: {
      id?: string | null;
    } | null;
  } | null;
}

interface AddDiscussionCommentResponse {
  addDiscussionComment?: {
    comment?: DiscussionCommentPayload | null;
  } | null;
}

const PAGE_INFO_FIELDS = `
  pageInfo {
    hasNextPage
    endCursor
  }
`;

const DISCUSSION_ACTOR_FIELDS = `
  fragment DiscussionActorFields on Actor {
    login
    avatarUrl
    url
  }
`;

const DISCUSSION_REPLY_FIELDS = `
  fragment DiscussionReplyFields on DiscussionComment {
    id
    body
    url
    createdAt
    updatedAt
    isAnswer
    author {
      ...DiscussionActorFields
    }
    replyTo {
      id
    }
  }
`;

const DISCUSSION_COMMENT_FIELDS = `
  fragment DiscussionCommentFields on DiscussionComment {
    ...DiscussionReplyFields
    replies(first: ${INITIAL_REPLIES_PAGE_SIZE}) {
      totalCount
      ${PAGE_INFO_FIELDS}
      nodes {
        ...DiscussionReplyFields
      }
    }
  }
`;

const DISCUSSION_PARENT_FIELDS = `
  fragment DiscussionParentFields on Discussion {
    number
    repository {
      name
      owner {
        login
      }
    }
  }
`;

const FETCH_DISCUSSION_QUERY = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_COMMENT_FIELDS}
  query FetchDiscussion($owner: String!, $repo: String!, $discussionNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        id
        number
        title
        body
        url
        createdAt
        updatedAt
        locked
        isAnswered
        author {
          ...DiscussionActorFields
        }
        category {
          id
          name
          emoji
          description
          isAnswerable
          slug
        }
        answer {
          ...DiscussionReplyFields
        }
        comments(first: ${DISCUSSION_COMMENTS_PAGE_SIZE}) {
          totalCount
          ${PAGE_INFO_FIELDS}
          nodes {
            ...DiscussionCommentFields
          }
        }
      }
    }
  }
`;

const FETCH_DISCUSSION_COMMENTS_QUERY = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_COMMENT_FIELDS}
  query FetchDiscussionComments(
    $owner: String!
    $repo: String!
    $discussionNumber: Int!
    $cursor: String
  ) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        comments(first: ${DISCUSSION_COMMENTS_PAGE_SIZE}, after: $cursor) {
          totalCount
          ${PAGE_INFO_FIELDS}
          nodes {
            ...DiscussionCommentFields
          }
        }
      }
    }
  }
`;

const FETCH_DISCUSSION_COMMENT_REPLIES_QUERY = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_PARENT_FIELDS}
  query FetchDiscussionCommentReplies($commentId: ID!, $cursor: String) {
    node(id: $commentId) {
      ... on DiscussionComment {
        discussion {
          ...DiscussionParentFields
        }
        replyTo {
          id
        }
        replies(first: ${DISCUSSION_REPLIES_PAGE_SIZE}, after: $cursor) {
          totalCount
          ${PAGE_INFO_FIELDS}
          nodes {
            ...DiscussionReplyFields
          }
        }
      }
    }
  }
`;

const FETCH_DISCUSSION_NODE_ID_QUERY = `
  query FetchDiscussionNodeId($owner: String!, $repo: String!, $discussionNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        id
      }
    }
  }
`;

const FETCH_DISCUSSION_REPLY_CONTEXT_QUERY = `
  ${DISCUSSION_PARENT_FIELDS}
  query FetchDiscussionReplyContext(
    $owner: String!
    $repo: String!
    $discussionNumber: Int!
    $commentId: ID!
  ) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $discussionNumber) {
        id
      }
    }
    node(id: $commentId) {
      ... on DiscussionComment {
        discussion {
          ...DiscussionParentFields
        }
        replyTo {
          id
        }
      }
    }
  }
`;

const ADD_DISCUSSION_COMMENT_MUTATION = `
  ${DISCUSSION_ACTOR_FIELDS}
  ${DISCUSSION_REPLY_FIELDS}
  ${DISCUSSION_COMMENT_FIELDS}
  mutation AddDiscussionComment($discussionId: ID!, $body: String!, $replyToId: ID) {
    addDiscussionComment(
      input: { discussionId: $discussionId, body: $body, replyToId: $replyToId }
    ) {
      comment {
        ...DiscussionCommentFields
      }
    }
  }
`;

function throwDiscussionNotFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Discussion not found',
  });
}

function throwDiscussionCommentNotFound(): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'Discussion comment not found',
  });
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw createError({
    statusCode: 500,
    statusMessage: `${fieldName} missing from GitHub response`,
  });
}

function requireNumber(value: unknown, fieldName: string) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  throw createError({
    statusCode: 500,
    statusMessage: `${fieldName} missing from GitHub response`,
  });
}

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function normalizeActor(actor: DiscussionActorPayload | null | undefined): DiscussionAuthor | null {
  if (!actor?.login) {
    return null;
  }

  return {
    login: actor.login,
    avatarUrl: normalizeOptionalString(actor.avatarUrl),
    url: normalizeOptionalString(actor.url),
  };
}

function normalizeCategory(
  category: DiscussionCategoryPayload | null | undefined
): DiscussionCategory | null {
  if (!category?.id || !category.name) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    emoji: normalizeOptionalString(category.emoji),
    description: typeof category.description === 'string' ? category.description : null,
    isAnswerable: Boolean(category.isAnswerable),
    slug: normalizeOptionalString(category.slug),
  };
}

function normalizePageInfo(
  pageInfo: DiscussionPageInfoPayload | null | undefined
): DiscussionPageInfo {
  return {
    hasNextPage: Boolean(pageInfo?.hasNextPage),
    endCursor: typeof pageInfo?.endCursor === 'string' ? pageInfo.endCursor : null,
  };
}

function normalizeConnection<TInput, TOutput>(
  connection: DiscussionConnectionPayload<TInput> | null | undefined,
  normalizeNode: (node: TInput) => TOutput,
  hasNodeId: (node: TInput) => boolean
) {
  const items: TOutput[] = [];

  for (const node of connection?.nodes ?? []) {
    if (node && hasNodeId(node)) {
      items.push(normalizeNode(node));
    }
  }

  return {
    items,
    totalCount: typeof connection?.totalCount === 'number' ? connection.totalCount : items.length,
    pageInfo: normalizePageInfo(connection?.pageInfo),
  };
}

function hasDiscussionReplyId(node: DiscussionReplyPayload) {
  return typeof node.id === 'string' && Boolean(node.id);
}

function normalizeReply(reply: DiscussionReplyPayload): DiscussionReply {
  const nodeId = requireString(reply.id, 'Discussion reply ID');

  return {
    id: nodeId,
    nodeId,
    body: typeof reply.body === 'string' ? reply.body : '',
    url: normalizeOptionalString(reply.url),
    createdAt: normalizeOptionalString(reply.createdAt),
    updatedAt: normalizeOptionalString(reply.updatedAt),
    author: normalizeActor(reply.author),
    isAnswer: Boolean(reply.isAnswer),
    replyToId: typeof reply.replyTo?.id === 'string' ? reply.replyTo.id : null,
  };
}

function normalizeReplies(
  replies: DiscussionConnectionPayload<DiscussionReplyPayload> | null | undefined
): DiscussionRepliesPayload {
  return normalizeConnection(replies, normalizeReply, hasDiscussionReplyId);
}

function normalizeComment(comment: DiscussionCommentPayload): DiscussionComment {
  return {
    ...normalizeReply(comment),
    replies: normalizeReplies(comment.replies),
  };
}

function normalizeComments(
  comments: DiscussionConnectionPayload<DiscussionCommentPayload> | null | undefined
): DiscussionCommentsPayload {
  return normalizeConnection(comments, normalizeComment, hasDiscussionReplyId);
}

function normalizeDiscussion(
  discussion: DiscussionPayload,
  owner: string,
  repo: string
): DiscussionDetailPayload {
  const nodeId = requireString(discussion.id, 'Discussion ID');

  return {
    id: nodeId,
    nodeId,
    owner,
    repo,
    repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    number: requireNumber(discussion.number, 'Discussion number'),
    title: typeof discussion.title === 'string' ? discussion.title : '',
    body: typeof discussion.body === 'string' ? discussion.body : '',
    url: normalizeOptionalString(discussion.url),
    createdAt: normalizeOptionalString(discussion.createdAt),
    updatedAt: normalizeOptionalString(discussion.updatedAt),
    author: normalizeActor(discussion.author),
    category: normalizeCategory(discussion.category),
    isAnswered: Boolean(discussion.isAnswered),
    answer: discussion.answer?.id ? normalizeReply(discussion.answer) : null,
    locked: Boolean(discussion.locked),
    comments: normalizeComments(discussion.comments),
  };
}

export function validateDiscussionNodeId(value: unknown, fieldName = 'Discussion node ID') {
  const nodeId = typeof value === 'string' ? value.trim() : '';

  if (!nodeId) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required`,
    });
  }

  return nodeId;
}

function isSameRouteSegment(left: string | null | undefined, right: string) {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

function assertDiscussionCommentBelongsToRoute(
  discussion: DiscussionParentPayload | null | undefined,
  owner: string,
  repo: string,
  discussionNumber: number
) {
  if (
    discussion?.number === discussionNumber &&
    isSameRouteSegment(discussion.repository?.owner?.login, owner) &&
    isSameRouteSegment(discussion.repository?.name, repo)
  ) {
    return;
  }

  throwDiscussionCommentNotFound();
}

function assertTopLevelDiscussionComment(replyTo: { id?: string | null } | null | undefined) {
  if (!replyTo?.id) {
    return;
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Discussion comment replies only support top-level comments',
  });
}

export async function fetchDiscussion(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number
): Promise<DiscussionDetailPayload> {
  const response = await octokit.graphql<FetchDiscussionResponse>(FETCH_DISCUSSION_QUERY, {
    owner,
    repo,
    discussionNumber,
  });
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  return normalizeDiscussion(discussion, owner, repo);
}

export async function fetchDiscussionComments(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number,
  cursor?: string
): Promise<DiscussionCommentsPayload> {
  const response = await octokit.graphql<FetchDiscussionCommentsResponse>(
    FETCH_DISCUSSION_COMMENTS_QUERY,
    {
      owner,
      repo,
      discussionNumber,
      cursor: cursor || null,
    }
  );
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  return normalizeComments(discussion.comments);
}

export async function fetchDiscussionNodeId(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number
): Promise<string> {
  const response = await octokit.graphql<FetchDiscussionNodeIdResponse>(
    FETCH_DISCUSSION_NODE_ID_QUERY,
    {
      owner,
      repo,
      discussionNumber,
    }
  );
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  return requireString(discussion.id, 'Discussion ID');
}

export async function fetchDiscussionReplyContext(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number,
  commentId: string
): Promise<{ discussionId: string; replyToId: string }> {
  const replyToId = validateDiscussionNodeId(commentId, 'Discussion comment ID');
  const response = await octokit.graphql<FetchDiscussionReplyContextResponse>(
    FETCH_DISCUSSION_REPLY_CONTEXT_QUERY,
    {
      owner,
      repo,
      discussionNumber,
      commentId: replyToId,
    }
  );
  const discussion = response.repository?.discussion;

  if (!discussion) {
    throwDiscussionNotFound();
  }

  assertDiscussionCommentBelongsToRoute(response.node?.discussion, owner, repo, discussionNumber);
  assertTopLevelDiscussionComment(response.node?.replyTo);

  return {
    discussionId: requireString(discussion.id, 'Discussion ID'),
    replyToId,
  };
}

export async function fetchDiscussionCommentReplies(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  discussionNumber: number,
  commentId: string,
  cursor?: string
): Promise<DiscussionRepliesPayload> {
  const response = await octokit.graphql<FetchDiscussionCommentRepliesResponse>(
    FETCH_DISCUSSION_COMMENT_REPLIES_QUERY,
    {
      commentId: validateDiscussionNodeId(commentId, 'Discussion comment ID'),
      cursor: cursor || null,
    }
  );

  if (!response.node?.replies) {
    throwDiscussionCommentNotFound();
  }

  assertDiscussionCommentBelongsToRoute(response.node.discussion, owner, repo, discussionNumber);
  assertTopLevelDiscussionComment(response.node.replyTo);

  return normalizeReplies(response.node.replies);
}

export async function addDiscussionComment(
  octokit: GitHubClient,
  discussionId: string,
  body: string
): Promise<DiscussionComment> {
  const response = await octokit.graphql<AddDiscussionCommentResponse>(
    ADD_DISCUSSION_COMMENT_MUTATION,
    {
      discussionId: validateDiscussionNodeId(discussionId, 'Discussion ID'),
      body,
      replyToId: null,
    }
  );
  const comment = response.addDiscussionComment?.comment;

  if (!comment?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Created discussion comment missing from GitHub response',
    });
  }

  return normalizeComment(comment);
}

export async function addDiscussionReply(
  octokit: GitHubClient,
  discussionId: string,
  replyToId: string,
  body: string
): Promise<DiscussionReply> {
  const response = await octokit.graphql<AddDiscussionCommentResponse>(
    ADD_DISCUSSION_COMMENT_MUTATION,
    {
      discussionId: validateDiscussionNodeId(discussionId, 'Discussion ID'),
      body,
      replyToId: validateDiscussionNodeId(replyToId, 'Discussion comment ID'),
    }
  );
  const reply = response.addDiscussionComment?.comment;

  if (!reply?.id) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Created discussion reply missing from GitHub response',
    });
  }

  return normalizeReply(reply);
}
