import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';

interface PullFileResponse {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
  sha?: string;
  blob_url?: string;
  raw_url?: string;
  contents_url?: string;
  previous_filename?: string;
}

const normalizePullFile = (file: PullFileResponse) => ({
  filename: file.filename ?? '',
  status: file.status ?? 'modified',
  additions: file.additions ?? 0,
  deletions: file.deletions ?? 0,
  changes: file.changes ?? 0,
  patch: file.patch,
  sha: file.sha,
  blob_url: file.blob_url,
  raw_url: file.raw_url,
  contents_url: file.contents_url,
  previous_filename: file.previous_filename,
});

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

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const perPage = parsePaginationNumber(query.per_page, 100, 100);
    const pullNumber = Number.parseInt(pull_number, 10);

    if (!Number.isFinite(pullNumber) || pullNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pull request number',
      });
    }

    const octokit = await getGitHubClient(event);
    const { data, headers } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
      {
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: perPage,
      }
    );

    const files = Array.isArray(data) ? data.map(normalizePullFile) : [];

    return {
      items: files,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
        totalCount: null,
      }),
    };
  } catch (error: unknown) {
    console.error('Error fetching pull request files:', error);

    const statusCode = getErrorNumber(error, 'statusCode');
    const status = getErrorNumber(error, 'status');
    const message = getErrorMessage(error);

    if (statusCode) {
      throw error;
    }

    if (status) {
      throw createError({
        statusCode: status,
        statusMessage: message || 'Failed to fetch pull request files',
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch pull request files',
    });
  }
});
