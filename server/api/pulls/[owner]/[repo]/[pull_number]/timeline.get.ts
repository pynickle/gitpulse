import {
  buildPRTimelineCapabilities,
  createUnsupportedWarnings,
  enrichPRTimelineWithReviewData,
  fetchPaginatedArray,
  fetchPRReviewThreads,
  fetchTimelinePage,
  normalizePRTimelineEvent,
  sortTimelineItems,
  throwTimelineFatalError,
} from '#server/utils/github-timeline-utils';

function buildPullCommitLookup(commits: Record<string, any>[]) {
  const commitsBySha = new Map<string, Record<string, any>>();

  for (const commit of commits) {
    const sha = typeof commit.sha === 'string' ? commit.sha : undefined;

    if (sha) {
      commitsBySha.set(sha, commit);
    }
  }

  return commitsBySha;
}

function enrichTimelineEventWithPullCommit(
  rawEvent: Record<string, any>,
  commitsBySha: Map<string, Record<string, any>>
) {
  const commitSha =
    typeof rawEvent.sha === 'string'
      ? rawEvent.sha
      : typeof rawEvent.commit_id === 'string'
        ? rawEvent.commit_id
        : undefined;

  if (!commitSha) {
    return rawEvent;
  }

  const pullCommit = commitsBySha.get(commitSha);

  if (!pullCommit) {
    return rawEvent;
  }

  return {
    ...rawEvent,
    commit: rawEvent.commit ?? pullCommit.commit,
    author_user: rawEvent.author_user ?? pullCommit.author,
    committer_user: rawEvent.committer_user ?? pullCommit.committer,
    html_url: rawEvent.html_url ?? pullCommit.html_url,
    url: rawEvent.url ?? pullCommit.url,
    comments_url: rawEvent.comments_url ?? pullCommit.comments_url,
    parents: rawEvent.parents ?? pullCommit.parents,
  };
}

async function fetchPRReviewThreadsForTimeline(
  octokit: Parameters<typeof fetchPRReviewThreads>[0],
  owner: string,
  repo: string,
  pullNumber: number
) {
  try {
    return await fetchPRReviewThreads(octokit, owner, repo, pullNumber);
  } catch (error: unknown) {
    console.warn('Failed to fetch pull request review threads:', error);
    return [];
  }
}

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const pullNumber = parsePaginationNumber(pull_number, 0);

    if (!owner || !repo || pullNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);

    const [timelinePage, pullCommits, pullReviews, pullReviewComments, pullReviewThreads] =
      await Promise.all([
        fetchTimelinePage<Record<string, any>>(
          octokit,
          'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline',
          {
            owner,
            repo,
            issue_number: pullNumber,
          },
          page
        ),
        fetchPaginatedArray<Record<string, any>>(
          octokit,
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
          {
            owner,
            repo,
            pull_number: pullNumber,
          }
        ),
        fetchPaginatedArray<Record<string, any>>(
          octokit,
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
          {
            owner,
            repo,
            pull_number: pullNumber,
          }
        ),
        fetchPaginatedArray<Record<string, any>>(
          octokit,
          'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
          {
            owner,
            repo,
            pull_number: pullNumber,
          }
        ),
        fetchPRReviewThreadsForTimeline(octokit, owner, repo, pullNumber),
      ]);

    const pullCommitsBySha = buildPullCommitLookup(pullCommits);
    const enrichedTimeline = timelinePage.items.map((rawEvent) =>
      enrichTimelineEventWithPullCommit(rawEvent, pullCommitsBySha)
    );

    const normalizedTimeline = sortTimelineItems(
      enrichedTimeline.flatMap((rawEvent) => normalizePRTimelineEvent(rawEvent, { owner, repo }))
    );
    const timeline = enrichPRTimelineWithReviewData(
      normalizedTimeline,
      pullReviews,
      pullReviewComments,
      pullReviewThreads
    );

    return {
      timeline,
      pageInfo: {
        hasNextPage: timelinePage.hasNextPage,
        endCursor: null,
      },
      capabilities: buildPRTimelineCapabilities(),
      warnings: createUnsupportedWarnings('pull'),
      errors: [],
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub pull request timeline:', error);
    throwTimelineFatalError(error, 'Failed to fetch pull request timeline');
  }
});
