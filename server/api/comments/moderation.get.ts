import {
  fetchCommentNodes,
  normalizeCommentModeration,
} from '#server/utils/comment-moderation-utils';
import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const nodeId = getQuery(event).nodeId;
  if (typeof nodeId !== 'string' || !nodeId.trim())
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment ID' });
  const octokit = await getGitHubClient(event);
  try {
    const node = (await fetchCommentNodes(octokit, [nodeId])).get(nodeId);
    const moderation = node && normalizeCommentModeration(node);
    if (!moderation) throw createError({ statusCode: 404, statusMessage: 'Comment not found' });
    return { moderation, body: node?.body };
  } catch (error) {
    throwGitHubRouteError(error, 'Failed to fetch comment capabilities');
  }
});
