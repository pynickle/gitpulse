import {
  getGitHubErrorMessage,
  getGitHubErrorStatusCode,
} from '../../../../../../utils/github-auth-utils';

function hasRouteStatusCode(error: unknown): error is { statusCode: unknown } {
  return !!error && typeof error === 'object' && 'statusCode' in error && !!error.statusCode;
}

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };

    const body = await readBody<{ body?: string }>(event);
    const commentBody = body?.body?.trim();

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
        issue_number: Number.parseInt(issue_number, 10),
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
