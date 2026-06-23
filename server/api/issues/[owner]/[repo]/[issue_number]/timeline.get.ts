import {
  buildIssueTimelineCapabilities,
  createUnsupportedWarnings,
  fetchTimelinePage,
  normalizeIssueTimelineEvent,
  normalizeTimelineStateItems,
  sortTimelineItems,
  throwTimelineFatalError,
} from '#server/utils/github-timeline-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };

    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const issueNumber = parsePaginationNumber(issue_number, 0);

    if (!owner || !repo || issueNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters',
      });
    }

    const octokit = await getGitHubClient(event);

    const { items, hasNextPage } = await fetchTimelinePage<Record<string, any>>(
      octokit,
      'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline',
      {
        owner,
        repo,
        issue_number: issueNumber,
      },
      page
    );

    const timeline = normalizeTimelineStateItems(
      sortTimelineItems(
        items.map((rawEvent: Record<string, any>) =>
          normalizeIssueTimelineEvent(rawEvent, { owner, repo })
        )
      )
    );

    return {
      currentParent: null,
      timeline,
      pageInfo: {
        hasNextPage,
        endCursor: null,
      },
      capabilities: buildIssueTimelineCapabilities(),
      warnings: createUnsupportedWarnings('issue'),
      errors: [],
    };
  } catch (error: unknown) {
    console.error('Error fetching GitHub issue timeline:', error);
    throwTimelineFatalError(error, 'Failed to fetch issue timeline');
  }
});
