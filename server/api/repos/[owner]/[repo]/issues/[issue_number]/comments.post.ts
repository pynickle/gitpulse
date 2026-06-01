import { throwGitHubRouteError } from '../../../../../../utils/github-auth-utils';

interface CommentRequestBody {
  body?: unknown;
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
    const issueNumber = parsePaginationNumber(issue_number, 0);

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

    throwGitHubRouteError(error, 'Failed to create comment');
  }
});
