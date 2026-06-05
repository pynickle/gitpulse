import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';

interface PullFileResponse {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
  sha?: string | null;
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

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const perPage = parsePaginationNumber(query.per_page, 100, 100);
    const pullNumber = parsePaginationNumber(pull_number, 0);

    if (!owner || !repo || pullNumber < 1) {
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
    throwGitHubRouteError(error, 'Failed to fetch pull request files');
  }
});
