import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';

interface PullReviewCommentResponse {
  id?: number | string;
  node_id?: string;
  pull_request_review_id?: number | string;
  in_reply_to_id?: number | string | null;
  body?: string;
  path?: string;
  html_url?: string;
  diff_hunk?: string;
  position?: number | null;
  original_position?: number | null;
  start_line?: number | null;
  original_start_line?: number | null;
  line?: number | null;
  original_line?: number | null;
  start_side?: 'LEFT' | 'RIGHT' | string | null;
  side?: 'LEFT' | 'RIGHT' | string | null;
  created_at?: string;
  updated_at?: string;
  user?: {
    login?: string;
    avatar_url?: string;
    html_url?: string;
  } | null;
}

const stringifyId = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
};

const normalizeReviewComment = (comment: PullReviewCommentResponse) => ({
  id: stringifyId(comment.id ?? comment.node_id) ?? '',
  pullRequestReviewId: stringifyId(comment.pull_request_review_id),
  inReplyToId: stringifyId(comment.in_reply_to_id),
  body: comment.body ?? '',
  path: comment.path ?? '',
  url: comment.html_url,
  diffHunk: comment.diff_hunk,
  position: comment.position ?? null,
  originalPosition: comment.original_position ?? null,
  startLine: comment.start_line ?? null,
  originalStartLine: comment.original_start_line ?? null,
  line: comment.line ?? null,
  originalLine: comment.original_line ?? null,
  startSide: comment.start_side ?? null,
  side: comment.side ?? null,
  createdAt: comment.created_at,
  updatedAt: comment.updated_at,
  author: comment.user
    ? {
        login: comment.user.login,
        avatarUrl: comment.user.avatar_url,
        url: comment.user.html_url,
      }
    : undefined,
});

const compareReviewComments = (
  first: ReturnType<typeof normalizeReviewComment>,
  second: ReturnType<typeof normalizeReviewComment>
) => {
  const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER;
  const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER;

  if (firstPosition !== secondPosition) {
    return firstPosition - secondPosition;
  }

  const firstDate = Date.parse(first.createdAt ?? '') || 0;
  const secondDate = Date.parse(second.createdAt ?? '') || 0;
  return firstDate - secondDate;
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

    const octokit = await getGitHubClient(event);
    const reviewComments = await fetchPaginatedArray<PullReviewCommentResponse>(
      octokit,
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
      {
        owner,
        repo,
        pull_number: pullNumber,
      }
    );

    return {
      items: reviewComments
        .filter((comment) => comment.position !== null && comment.position !== undefined)
        .map(normalizeReviewComment)
        .filter((comment) => comment.path)
        .sort(compareReviewComments),
    };
  } catch (error: unknown) {
    console.error('Error fetching pull request review comments:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request review comments');
  }
});
