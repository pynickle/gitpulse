import { buildLinkedPaginationMeta, parsePaginationNumber } from '#server/utils/github-pagination';
import { fetchCommitCheckRollups } from '#server/utils/pr-check-rollup-graphql-utils';
import {
  buildPullRequestCommitUrl,
  mapGitHubCommitToCommitListItem,
  type GitHubCommitListItem,
} from '#server/utils/repo-latest-commit-utils';
import type { RepoCommitListItemPayload, RepoCommitListResponse } from '#shared/types/repos';

const DEFAULT_COMMITS_PER_PAGE = 30;
const MAX_COMMITS_PER_PAGE = 100;

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const perPage = parsePaginationNumber(
      query.per_page,
      DEFAULT_COMMITS_PER_PAGE,
      MAX_COMMITS_PER_PAGE
    );
    const pullNumber = parsePaginationNumber(pull_number, 0);

    if (!owner || !repo || pullNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid pull request number',
      });
    }

    const octokit = await getGitHubClient(event);
    const { data, headers } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      {
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: perPage,
      }
    );

    const rawCommits = Array.isArray(data) ? (data as GitHubCommitListItem[]) : [];
    const commits = rawCommits.flatMap((commit) => {
      const item = mapGitHubCommitToCommitListItem(commit);
      return item ? [item] : [];
    });
    const rollups = await fetchCommitCheckRollups(
      octokit,
      owner,
      repo,
      commits.map((item) => item.sha)
    );
    const items: RepoCommitListItemPayload[] = commits.map((item) => ({
      ...item,
      htmlUrl: buildPullRequestCommitUrl(owner, repo, pullNumber, item.sha),
      checkRollup: rollups.get(item.sha) ?? null,
    }));

    return {
      items,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
        totalCount: null,
      }),
    } satisfies RepoCommitListResponse;
  } catch (error: unknown) {
    console.error('Error fetching pull request commits:', error);
    throwGitHubRouteError(error, 'Failed to fetch pull request commits');
  }
});
