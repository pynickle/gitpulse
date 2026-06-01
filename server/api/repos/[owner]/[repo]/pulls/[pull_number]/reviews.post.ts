type ReviewEvent = 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES';

interface ReviewRequestBody {
  commitId?: string;
  event?: ReviewEvent;
  body?: string;
  comments?: unknown[];
}

const allowedEvents = new Set<ReviewEvent>(['APPROVE', 'COMMENT', 'REQUEST_CHANGES']);

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeReviewComments = (comments: unknown[] | undefined) => {
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.map((comment, index) => {
    const entry =
      comment && typeof comment === 'object' && !Array.isArray(comment)
        ? (comment as Record<string, unknown>)
        : {};
    const path = trimString(entry.path);
    const body = trimString(entry.body);
    const position = Number(entry.position);

    if (!path || !body || !Number.isSafeInteger(position) || position < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid review comment at index ${index}`,
      });
    }

    return {
      path,
      body,
      position,
    };
  });
};

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const pullNumber = parsePaginationNumber(pull_number, 0);

    if (!owner || !repo || pullNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pull request number',
      });
    }

    const body = await readBody<ReviewRequestBody>(event);
    const commitId = trimString(body?.commitId);
    const reviewEvent = body?.event;
    const reviewBody = trimString(body?.body);

    if (!commitId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Review commitId is required',
      });
    }

    if (!reviewEvent || !allowedEvents.has(reviewEvent)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Review event must be APPROVE, COMMENT, or REQUEST_CHANGES',
      });
    }

    if ((reviewEvent === 'COMMENT' || reviewEvent === 'REQUEST_CHANGES') && !reviewBody) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Review body is required for this event',
      });
    }

    const comments = normalizeReviewComments(body?.comments);
    const octokit = await getGitHubClient(event);
    const { data: review } = await octokit.request(
      'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      {
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitId,
        event: reviewEvent,
        body: reviewBody || undefined,
        comments,
      }
    );

    return review;
  } catch (error: unknown) {
    console.error('Error creating pull request review:', error);
    throwGitHubRouteError(error, 'Failed to create pull request review');
  }
});
