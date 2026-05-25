type ReviewEvent = 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES';

interface ReviewCommentPayload {
  path?: string;
  body?: string;
  position?: number;
}

interface ReviewRequestBody {
  commitId?: string;
  event?: ReviewEvent;
  body?: string;
  comments?: ReviewCommentPayload[];
}

const allowedEvents = new Set<ReviewEvent>(['APPROVE', 'COMMENT', 'REQUEST_CHANGES']);

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getErrorNumber = (error: unknown, key: 'status' | 'statusCode') => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
};

const getErrorMessage = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const value = (error as Record<string, unknown>).message;
  return typeof value === 'string' ? value : '';
};

const normalizeReviewComments = (comments: ReviewCommentPayload[] | undefined) => {
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments.map((comment, index) => {
    const path = trimString(comment.path);
    const body = trimString(comment.body);
    const position = Number(comment.position);

    if (!path || !body || !Number.isInteger(position) || position < 1) {
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

    const pullNumber = Number.parseInt(pull_number, 10);

    if (!Number.isFinite(pullNumber) || pullNumber < 1) {
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

    const statusCode = getErrorNumber(error, 'statusCode');
    const status = getErrorNumber(error, 'status');
    const message = getErrorMessage(error);

    if (statusCode) {
      throw error;
    }

    if (status) {
      throw createError({
        statusCode: status,
        statusMessage: message || 'Failed to create pull request review',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create pull request review',
    });
  }
});
