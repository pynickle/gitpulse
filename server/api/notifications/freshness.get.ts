import {
  getLatestUpdatedAt,
  parseGitHubPollIntervalMs,
  type FreshnessResponse,
} from '#server/utils/freshness-response-utils';
import type { DashboardNotification } from '#shared/types/notifications';
import { createCollectionFreshnessSignature } from '#shared/utils/freshness';

import { parsePaginationNumber } from '../../utils/github-pagination';

const getQueryString = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue.trim() : '';
};

const getNotificationRepoFullName = (notification: DashboardNotification) => {
  if (notification.repository?.full_name) {
    return notification.repository.full_name;
  }

  const repositoryUrl = notification.repository?.url;
  if (typeof repositoryUrl !== 'string') {
    return '';
  }

  const match = repositoryUrl.match(/\/repos\/([^/]+)\/([^/]+)$/);
  return match ? `${match[1]}/${match[2]}` : '';
};

const applyNotificationFreshnessFilters = (
  notifications: DashboardNotification[],
  filters: {
    readState?: 'read' | 'unread';
    repo?: string;
    reason?: string;
    subjectType?: string;
  }
) => {
  const repo = filters.repo?.toLowerCase();

  return notifications.filter((notification) => {
    if (filters.readState === 'read' && notification.unread) return false;
    if (filters.readState === 'unread' && !notification.unread) return false;

    if (repo && getNotificationRepoFullName(notification).toLowerCase() !== repo) {
      return false;
    }

    if (filters.reason && notification.reason !== filters.reason) {
      return false;
    }

    if (filters.subjectType && notification.subject?.type !== filters.subjectType) {
      return false;
    }

    return true;
  });
};

export default definePrivateApiCoalescedEventHandler(async (event) => {
  const octokit = await getGitHubClient(event);
  const query = getQuery(event);
  const perPage = parsePaginationNumber(query.per_page, 10, 25);
  const all = query.all === 'true' || query.all === true;
  const participating = query.participating === 'true' || query.participating === true;
  const since =
    typeof query.since === 'string' && query.since.trim() ? query.since.trim() : undefined;
  const before =
    typeof query.before === 'string' && query.before.trim() ? query.before.trim() : undefined;
  const readState = getQueryString(query.read_state);
  const filters = {
    readState:
      readState === 'read' || readState === 'unread' ? (readState as 'read' | 'unread') : undefined,
    repo: getQueryString(query.repo) || undefined,
    reason: getQueryString(query.reason) || undefined,
    subjectType: getQueryString(query.subject_type) || undefined,
  };

  try {
    const { data: notifications, headers } = await octokit.request('GET /notifications', {
      all,
      participating,
      since,
      before,
      page: 1,
      per_page: perPage,
    });
    const filteredNotifications = applyNotificationFreshnessFilters(notifications, filters);

    return {
      signature: createCollectionFreshnessSignature(filteredNotifications, {
        all,
        participating,
        since,
        before,
        readState: filters.readState,
        repo: filters.repo,
        reason: filters.reason,
        subjectType: filters.subjectType,
      }),
      itemCount: filteredNotifications.length,
      latestUpdatedAt: getLatestUpdatedAt(filteredNotifications),
      pollIntervalMs: parseGitHubPollIntervalMs(headers['x-poll-interval']),
    } satisfies FreshnessResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    console.error('Error checking GitHub notification freshness:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to check notification freshness',
    });
  }
});
