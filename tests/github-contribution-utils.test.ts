import { describe, expect, test } from 'bun:test';

import {
  normalizeContributionCalendar,
  type GraphQLContributionResponse,
} from '../server/utils/github-contribution-utils';

const buildResponse = (
  weeks: { days: { date: string; count?: number; level?: string }[] }[],
  total = 0
): GraphQLContributionResponse => ({
  user: {
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: total,
        weeks: weeks.map((week) => ({
          contributionDays: week.days.map((day) => ({
            date: day.date,
            contributionCount: day.count,
            contributionLevel: day.level,
          })),
        })),
      },
    },
  },
});

describe('normalizeContributionCalendar', () => {
  test('maps GraphQL levels to 0–4 buckets and keeps counts', () => {
    const calendar = normalizeContributionCalendar(
      buildResponse(
        [
          {
            days: [
              { date: '2026-01-04', count: 0, level: 'NONE' },
              { date: '2026-01-05', count: 2, level: 'FIRST_QUARTILE' },
              { date: '2026-01-06', count: 5, level: 'SECOND_QUARTILE' },
              { date: '2026-01-07', count: 9, level: 'THIRD_QUARTILE' },
              { date: '2026-01-08', count: 20, level: 'FOURTH_QUARTILE' },
            ],
          },
        ],
        36
      )
    );

    expect(calendar.totalContributions).toBe(36);
    expect(calendar.weeks).toHaveLength(1);
    expect(calendar.weeks[0]!.days.map((day) => day.level)).toEqual([0, 1, 2, 3, 4]);
    expect(calendar.weeks[0]!.days.map((day) => day.count)).toEqual([0, 2, 5, 9, 20]);
  });

  test('falls back to level 0 for unknown or missing levels', () => {
    const calendar = normalizeContributionCalendar(
      buildResponse([
        {
          days: [
            { date: '2026-01-04', count: 1, level: 'SOMETHING_NEW' },
            { date: '2026-01-05', count: 1 },
          ],
        },
      ])
    );

    expect(calendar.weeks[0]!.days.map((day) => day.level)).toEqual([0, 0]);
  });

  test('drops days without a date and tolerates missing counts', () => {
    const response: GraphQLContributionResponse = {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: [
              {
                contributionDays: [{ contributionCount: 3 }, { date: '2026-01-05' }],
              },
            ],
          },
        },
      },
    };

    const calendar = normalizeContributionCalendar(response);

    expect(calendar.totalContributions).toBe(0);
    expect(calendar.weeks[0]!.days).toHaveLength(1);
    expect(calendar.weeks[0]!.days[0]).toEqual({ date: '2026-01-05', count: 0, level: 0 });
  });

  test('returns an empty calendar for missing user or calendar nodes', () => {
    expect(normalizeContributionCalendar({})).toEqual({
      totalContributions: 0,
      weeks: [],
    });
    expect(normalizeContributionCalendar({ user: null })).toEqual({
      totalContributions: 0,
      weeks: [],
    });
  });
});
