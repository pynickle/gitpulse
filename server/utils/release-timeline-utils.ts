import type { H3Event } from 'h3';
import { getQuery, createError } from 'h3';
import { z } from 'zod';

import type { ReleaseTimelinePage } from '#shared/types/release-follows';
import { applyFollowRenames } from '#shared/utils/release-follows';
import { assembleReleaseTimeline } from '#shared/utils/release-timeline';

import { getGitHubSessionContext } from './github-auth-utils';
import { fetchFollowedRepositoryReleaseLookups } from './release-timeline-graphql-utils';
import { createTimelineHistoryService } from './timeline-history-utils';
import { renameFollowedRepositories, readUserSettings } from './user-settings-utils';

const parseTimeZone = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'UTC';
  }

  const timeZone = raw.trim();
  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
};

export async function loadReleaseTimelineRound(
  event: H3Event,
  refresh = false
): Promise<ReleaseTimelinePage> {
  const { octokit, userLogin } = await getGitHubSessionContext(event);
  const settings = await readUserSettings(userLogin);
  const query = getQuery(event);
  let cursors: Record<string, string | null> | undefined;
  if (!refresh && query.cursors !== undefined) {
    try {
      cursors = z
        .record(z.string(), z.string().max(1024).nullable())
        .parse(JSON.parse(String(query.cursors)));
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid timeline cursors' });
    }
  }
  const follows = (settings.followedRepositories ?? []).filter(
    (repo) => !cursors || Object.hasOwn(cursors, repo.id)
  );
  const history = createTimelineHistoryService();
  let previousBaseline: string | null = null;
  let persistenceError: string | undefined;
  if (refresh) {
    try {
      previousBaseline = (await history.read(userLogin)).baseline;
    } catch {
      persistenceError = 'Could not read the saved timeline baseline.';
    }
  }
  const startedAt = new Date().toISOString();
  // All connections use aliases, even on the first round, to classify partial errors by path.
  const pages = await fetchFollowedRepositoryReleaseLookups(octokit, follows, {
    cursors: cursors ?? Object.fromEntries(follows.map((repo) => [repo.id, null])),
  });
  const renamed = applyFollowRenames(follows, pages);
  if (renamed) {
    try {
      await renameFollowedRepositories(userLogin, pages);
    } catch (error) {
      console.warn('Failed to write back renamed Followed Repositories:', error);
    }
  }
  if (
    refresh &&
    !persistenceError &&
    Object.values(pages).some(
      (page) =>
        page.status === 'available' &&
        (!page.incomplete ||
          page.releases.some(
            (item) =>
              !item.isDraft && item.publishedAt && Number.isFinite(Date.parse(item.publishedAt))
          ))
    )
  ) {
    try {
      await history.advanceBaseline(userLogin, startedAt);
    } catch {
      persistenceError = 'Could not save the timeline refresh baseline.';
    }
  }
  return {
    ...assembleReleaseTimeline(follows, pages, { timeZone: parseTimeZone(query.timeZone) }),
    pages,
    ...(refresh ? { refresh: { previousBaseline, startedAt } } : {}),
    ...(persistenceError ? { persistenceError } : {}),
  };
}
