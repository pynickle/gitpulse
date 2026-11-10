import { z } from 'zod';

import {
  fetchCommentNodes,
  COMMENT_MODERATION_FIELDS,
  normalizeCommentModeration,
  type CommentModerationNode,
  type CommentNode,
} from '#server/utils/comment-moderation-utils';
import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { COMMENT_HIDDEN_REASONS } from '#shared/types/comment-moderation';
import type { CommentModerationResult } from '#shared/types/comment-moderation';

const target = { nodeId: z.string().trim().min(1) };
const bodySchema = z.discriminatedUnion('action', [
  z
    .object({ ...target, action: z.literal('hide'), reason: z.enum(COMMENT_HIDDEN_REASONS) })
    .strict(),
  z.object({ ...target, action: z.literal('unhide') }).strict(),
  z.object({ ...target, action: z.literal('delete') }).strict(),
]);

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment operation' });
  const input = parsed.data;
  const octokit = await getGitHubClient(event);
  try {
    const currentNode = (await fetchCommentNodes(octokit, [input.nodeId])).get(input.nodeId);
    const current = currentNode && normalizeCommentModeration(currentNode);
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Comment not found' });
    if (input.action === 'delete' && current.resourceType === 'CommitComment') {
      if (!currentNode?.repository || !current.databaseId)
        throw createError({ statusCode: 502, statusMessage: 'Missing commit comment target' });
      await octokit.request('DELETE /repos/{owner}/{repo}/comments/{comment_id}', {
        owner: currentNode.repository.owner.login,
        repo: currentNode.repository.name,
        comment_id: current.databaseId,
      });
      return { moderation: null, deleted: true };
    }
    if (input.action === 'delete' && current.resourceType === 'DiscussionComment') {
      const response = await octokit.graphql<{
        deleteDiscussionComment?: { comment?: CommentNode | null };
      }>(
        `mutation DeleteDiscussionComment($id: ID!) {
          deleteDiscussionComment(input: {id: $id}) {
            comment { __typename id body databaseId ${COMMENT_MODERATION_FIELDS} replies { totalCount } }
          }
        }`,
        { id: input.nodeId }
      );
      if (!response.deleteDiscussionComment)
        throw createError({ statusCode: 502, statusMessage: 'GitHub did not delete the comment' });
      const remaining = response.deleteDiscussionComment.comment;
      const wiped = Boolean(remaining && (remaining.replies?.totalCount ?? 0) > 0);
      const result: CommentModerationResult = {
        deleted: !wiped,
        moderation: wiped && remaining ? (normalizeCommentModeration(remaining) ?? null) : null,
        ...(wiped ? { body: remaining?.body ?? '' } : {}),
      };
      if (currentNode?.discussion) {
        const snapshot = await octokit.graphql<{
          discussion: {
            id: string;
            isAnswered: boolean;
            answer: { id: string } | null;
            comments: { totalCount: number };
          };
          parent?: { id: string; replies: { totalCount: number } } | null;
        }>(
          `query DiscussionAfterDeletion($id: ID!, $parentId: ID!) {
          discussion: node(id: $id) { ... on Discussion { id isAnswered answer { id } comments { totalCount } } }
          parent: node(id: $parentId) { ... on DiscussionComment { id replies { totalCount } } }
        }`,
          {
            id: currentNode.discussion.id,
            parentId: currentNode.replyTo?.id ?? currentNode.discussion.id,
          }
        );
        result.discussion = {
          id: snapshot.discussion.id,
          isAnswered: snapshot.discussion.isAnswered,
          answerId: snapshot.discussion.answer?.id ?? null,
          totalCount: snapshot.discussion.comments.totalCount,
          ...(snapshot.parent?.replies
            ? { parentId: snapshot.parent.id, replyCount: snapshot.parent.replies.totalCount }
            : {}),
        };
      }
      return result;
    }
    if (
      input.action === 'delete' &&
      current.resourceType !== 'CommitComment' &&
      current.resourceType !== 'DiscussionComment'
    ) {
      const mutation = {
        IssueComment: 'deleteIssueComment',
        PullRequestReviewComment: 'deletePullRequestReviewComment',
        PullRequestReview: 'deletePullRequestReview',
      }[current.resourceType];
      const idField = current.resourceType === 'PullRequestReview' ? 'pullRequestReviewId' : 'id';
      const response = await octokit.graphql<Record<string, unknown>>(
        `mutation DeleteComment($id: ID!) { ${mutation}(input: {${idField}: $id}) { clientMutationId } }`,
        { id: input.nodeId }
      );
      if (!response[mutation])
        throw createError({ statusCode: 502, statusMessage: 'GitHub did not delete the comment' });
      return { moderation: null, deleted: true };
    }
    if (input.action === 'hide' || input.action === 'unhide') {
      const hiding = input.action === 'hide';
      const mutation = hiding ? 'minimizeComment' : 'unminimizeComment';
      const field = hiding ? 'minimizedComment' : 'unminimizedComment';
      const response = await octokit.graphql<Record<string, Record<string, CommentModerationNode>>>(
        `mutation ModerateComment($subjectId: ID!${hiding ? ', $classifier: ReportedContentClassifiers!' : ''}) {
          ${mutation}(input: {subjectId: $subjectId${hiding ? ', classifier: $classifier' : ''}}) {
            ${field} { ... on Node { id } __typename ... on Deletable { viewerCanDelete } isMinimized minimizedReason viewerCanMinimize viewerCanUnminimize }
          }
        }`,
        { subjectId: input.nodeId, ...(hiding ? { classifier: input.reason } : {}) }
      );
      const node = response[mutation]?.[field];
      if (
        !node ||
        node.isMinimized !== hiding ||
        node.id !== input.nodeId ||
        !normalizeCommentModeration(node)
      )
        throw createError({ statusCode: 502, statusMessage: 'GitHub did not update the comment' });
      return {
        moderation: normalizeCommentModeration({ ...node, databaseId: current.databaseId }),
      };
    }
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment operation' });
  } catch (error) {
    throwGitHubRouteError(error, 'Failed to moderate comment');
  }
});
