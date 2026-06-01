import {
  getGitHubErrorMessage,
  getGitHubErrorStatusCode,
} from '../../../../../../utils/github-auth-utils';

interface CommentRequestBody {
  body?: unknown;
}

function hasRouteStatusCode(error: unknown): error is { statusCode: unknown } {
  return !!error && typeof error === 'object' && 'statusCode' in error && !!error.statusCode;
}

function parseIssueNumber(value: string) {
  if (!/^\d+$/.test(value)) {
    return 0;
  }

  const issueNumber = Number.parseInt(value, 10);
  return Number.isSafeInteger(issueNumber) ? issueNumber : 0;
}

function normalizeCommentBody(body: unknown) {
  const requestBody =
    body && typeof body === 'object' && !Array.isArray(body) ? (body as CommentRequestBody) : {};

  return typeof requestBody.body === 'string' ? requestBody.body.trim() : '';
}

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };
    const issueNumber = parseIssueNumber(issue_number);

    if (!owner || !repo || issueNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const commentBody = normalizeCommentBody(await readBody(event));

    if (!commentBody) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Comment body is required',
      });
    }

    const octokit = await getGitHubClient(event);
    const { data: comment } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner,
        repo,
        issue_number: issueNumber,
        body: commentBody,
      }
    );

    return comment;
  } catch (error: unknown) {
    console.error('Error creating issue comment:', error);

    if (hasRouteStatusCode(error)) {
      throw error;
    }

    const statusCode = getGitHubErrorStatusCode(error);
    if (statusCode) {
      throw createError({
        statusCode,
        statusMessage: getGitHubErrorMessage(error, 'Failed to create comment'),
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create comment',
    });
  }
});
