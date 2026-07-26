import type { Octokit } from '@octokit/core';

import type { ContributionCalendar, ContributionDay, ContributionWeek } from '#shared/types/users';

/** GitHub GraphQL contribution intensity buckets → the 0–4 levels the wall renders. */
const CONTRIBUTION_LEVEL_BY_NAME: Record<string, ContributionDay['level']> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

interface GraphQLContributionDay {
  date?: string;
  contributionCount?: number;
  contributionLevel?: string;
}

interface GraphQLContributionWeek {
  contributionDays?: GraphQLContributionDay[];
}

export interface GraphQLContributionResponse {
  user?: {
    contributionsCollection?: {
      contributionCalendar?: {
        totalContributions?: number;
        weeks?: GraphQLContributionWeek[];
      };
    };
  } | null;
}

export const CONTRIBUTION_CALENDAR_QUERY = `
  query UserContributions($login: String!, $from: DateTime, $to: DateTime) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

const toCount = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

/**
 * Flatten GitHub's GraphQL contribution calendar into the wall's render shape,
 * tolerating missing fields (partial weeks, absent levels, null user) so a
 * malformed response yields an empty calendar rather than throwing.
 */
export function normalizeContributionCalendar(
  response: GraphQLContributionResponse
): ContributionCalendar {
  const calendar = response.user?.contributionsCollection?.contributionCalendar;
  const rawWeeks = Array.isArray(calendar?.weeks) ? calendar!.weeks : [];

  const weeks: ContributionWeek[] = rawWeeks.map((week) => {
    const days: ContributionDay[] = (
      Array.isArray(week.contributionDays) ? week.contributionDays : []
    )
      .filter((day): day is GraphQLContributionDay => Boolean(day?.date))
      .map((day) => ({
        date: day.date!,
        count: toCount(day.contributionCount),
        level: CONTRIBUTION_LEVEL_BY_NAME[day.contributionLevel ?? 'NONE'] ?? 0,
      }));

    return { days };
  });

  return {
    totalContributions: toCount(calendar?.totalContributions),
    weeks,
  };
}

/** `octokit.graphql` rejections carry the GraphQL `errors` array on the thrown error. */
const isGraphQLUserNotFoundError = (error: unknown): boolean => {
  const errors = (error as { errors?: { type?: string }[] } | null)?.errors;
  return Array.isArray(errors) && errors.some((entry) => entry?.type === 'NOT_FOUND');
};

/**
 * Contribution calendar for a login. Organizations (and deleted accounts) are
 * not GraphQL `user`s, so GitHub answers NOT_FOUND; those resolve to an empty
 * calendar instead of throwing — orgs legitimately have no contribution wall.
 */
export async function fetchContributionCalendar(
  octokit: Octokit,
  login: string,
  range?: { from?: string; to?: string }
): Promise<ContributionCalendar> {
  try {
    const response = await octokit.graphql<GraphQLContributionResponse>(
      CONTRIBUTION_CALENDAR_QUERY,
      {
        login,
        from: range?.from ?? null,
        to: range?.to ?? null,
      }
    );

    return normalizeContributionCalendar(response);
  } catch (error: unknown) {
    if (isGraphQLUserNotFoundError(error)) {
      return normalizeContributionCalendar({ user: null });
    }
    throw error;
  }
}
