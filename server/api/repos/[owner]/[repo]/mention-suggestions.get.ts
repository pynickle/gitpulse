import { fetchRepositoryMentionSuggestions } from '#server/utils/github-mention-utils';
import {
  executeGitHubRequestWithContext,
  extractRepoParams,
  getStringQueryParam,
} from '#server/utils/repo-route-utils';

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const query = getQuery(event);
  const searchQuery = getStringQueryParam(query.q) ?? '';

  return executeGitHubRequestWithContext(
    event,
    (octokit, context) =>
      fetchRepositoryMentionSuggestions(octokit, owner, repo, {
        accessTokenCacheKey: context.accessTokenCacheKey,
        query: searchQuery,
      }),
    'Failed to fetch repository mention suggestions'
  );
});
