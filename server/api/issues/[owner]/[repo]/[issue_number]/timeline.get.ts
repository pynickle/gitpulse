import {
  buildIssueTimelineCapabilities,
  createUnsupportedWarnings,
  fetchTimelinePage,
  normalizeIssueTimelineEvent,
  sortTimelineItems,
  throwTimelineFatalError,
} from '#server/utils/github-timeline-utils';

export default defineEventHandler(async (event) => {
  try {
    const { owner, repo, issue_number } = event.context.params as {
      owner: string;
      repo: string;
      issue_number: string;
    };

    const query = getQuery(event);
    const parsedPage = Number.parseInt(String(query.page ?? '1'), 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const octokit = await getGitHubClient(event);
    const issueNumber = parseInt(issue_number, 10);

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

    const timeline = sortTimelineItems(
      items.map((rawEvent: Record<string, any>) =>
        normalizeIssueTimelineEvent(rawEvent, { owner, repo })
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
  } catch (error: any) {
    console.error('Error fetching GitHub issue timeline:', error);
    throwTimelineFatalError(error, 'Failed to fetch issue timeline');
  }
});
