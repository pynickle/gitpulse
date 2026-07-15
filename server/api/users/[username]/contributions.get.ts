import { throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { fetchContributionCalendar } from '#server/utils/github-contribution-utils';
import { extractUsername } from '#server/utils/github-user-utils';
import { getStringQueryParam } from '#server/utils/repo-route-utils';
import type { ContributionCalendarResponse } from '#shared/types/users';

/** GitHub only accepts a from/to span of at most one year for the calendar. */
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/;

const parseIsoDateParam = (value: unknown): string | undefined => {
  const raw = getStringQueryParam(value);
  return raw && ISO_DATE_TIME_PATTERN.test(raw) ? raw : undefined;
};

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const username = extractUsername(event);
  const query = getQuery(event);
  const from = parseIsoDateParam(query.from);
  const to = parseIsoDateParam(query.to);

  try {
    const octokit = await getGitHubClient(event);
    return (await fetchContributionCalendar(octokit, username, {
      from,
      to,
    })) satisfies ContributionCalendarResponse;
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch contribution calendar');
  }
});
