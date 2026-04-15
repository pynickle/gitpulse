import {
  buildPRTimelineCapabilities,
  createUnsupportedWarnings,
  fetchPaginatedArray,
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

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, pull_number } = event.context.params as {
      owner: string;
      repo: string;
      pull_number: string;
    };

    const octokit = await getGitHubClient(event);
    const pullNumber = parseInt(pull_number, 10);

    const [pullRequestResponse, rawTimeline, pullCommits] = await Promise.all([
      octokit.request('GET /repos/{owner}/{repo}/issues/{pull_number}', {
        owner,
        repo,
        pull_number: pullNumber,
      }),
      fetchPaginatedArray<Record<string, any>>(
        octokit,
        'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline',
        {
          owner,
          repo,
          issue_number: pullNumber,
        }
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
    ]);

    const pullCommitsBySha = buildPullCommitLookup(pullCommits);
    const enrichedTimeline = rawTimeline.map((rawEvent) =>
      enrichTimelineEventWithPullCommit(rawEvent, pullCommitsBySha)
    );

    const timeline = sortTimelineItems(
      enrichedTimeline.flatMap((rawEvent) => normalizePRTimelineEvent(rawEvent, { owner, repo }))
    );

    return {
      timeline,
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
      },
      pullRequestNumber: pullRequestResponse.data.number,
      pullRequestTitle: pullRequestResponse.data.title,
      capabilities: buildPRTimelineCapabilities(),
      warnings: createUnsupportedWarnings('pull'),
      errors: [],
    };
  } catch (error: any) {
    console.error('Error fetching GitHub pull request timeline:', error);
    throwTimelineFatalError(error, 'Failed to fetch pull request timeline');
  }
});
