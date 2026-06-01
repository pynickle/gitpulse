import { throwGitHubRouteError } from '../../../../../../utils/github-auth-utils';

interface LabelsRequestBody {
  labels?: unknown;
}

function normalizeLabelsBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('labels' in body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid labels request body',
    });
  }

  const requestBody = body as LabelsRequestBody;
  const rawLabels = Array.isArray(requestBody.labels)
    ? requestBody.labels
    : requestBody.labels
      ? [requestBody.labels]
      : [];

  if (!rawLabels.every((label): label is string => typeof label === 'string')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid labels request body',
    });
  }

  return rawLabels;
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

    const labels = normalizeLabelsBody(await readBody(event));

    const octokit = await getGitHubClient(event);

    const { data: updatedLabels } = await octokit.request(
      'PUT /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      }
    );

    return updatedLabels;
  } catch (error: unknown) {
    console.error('Error updating issue labels:', error);

    throwGitHubRouteError(error, 'Failed to update issue labels');
  }
});
