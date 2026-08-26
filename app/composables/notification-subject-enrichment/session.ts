import type {
  DashboardNotification,
  NotificationSubjectEnrichmentResult,
  NotificationSubjectEnrichmentTarget,
} from '#shared/types/notifications';
import { readLinkedPullRequestListSummary } from '#shared/utils/linked-pull-requests';

interface ParsedNotificationSubjectTarget {
  owner: string;
  repo: string;
  number: number;
  type: 'issues' | 'pulls' | 'discussions' | 'releases';
}

interface NotificationSubjectEnrichmentAdapter {
  load: (
    targets: NotificationSubjectEnrichmentTarget[]
  ) => Promise<NotificationSubjectEnrichmentResult[]>;
}

interface NotificationSubjectEnrichmentComposition {
  adapter: NotificationSubjectEnrichmentAdapter;
  parseSubject: (
    subject?: DashboardNotification['subject'] | null
  ) => ParsedNotificationSubjectTarget | null;
}

export type NotificationSubjectEnrichmentOutcome =
  | {
      outcome: 'not-needed' | 'complete' | 'partial' | 'failed';
      notifications: DashboardNotification[];
    }
  | {
      outcome: 'stale';
    };

export interface NotificationSubjectEnrichmentRun {
  notifications: DashboardNotification[];
  completion: Promise<NotificationSubjectEnrichmentOutcome>;
}

const subjectEnrichmentChunkSize = 50;

const toEnrichableTarget = (
  target: ParsedNotificationSubjectTarget | null
): NotificationSubjectEnrichmentTarget | null => {
  if (!target || target.type === 'releases') return null;

  return {
    key: `${target.owner}/${target.repo}/${target.type}/${target.number}`,
    owner: target.owner,
    repo: target.repo,
    type: target.type,
    number: target.number,
  };
};

const createLoadingNotifications = (
  notifications: DashboardNotification[],
  parseSubject: NotificationSubjectEnrichmentComposition['parseSubject']
) => {
  const targetsByKey = new Map<string, NotificationSubjectEnrichmentTarget>();
  const targetKeys: Array<string | null> = [];

  const loadingNotifications = notifications.map((notification) => {
    const parsedTarget = parseSubject(notification.subject);
    const target = toEnrichableTarget(parsedTarget);
    targetKeys.push(target?.key ?? null);

    if (target) {
      targetsByKey.set(target.key, target);
    }

    return {
      ...notification,
      subject: notification.subject
        ? {
            ...notification.subject,
            number: parsedTarget?.number ?? notification.subject.number,
            stateStatus: target ? ('pending' as const) : ('unavailable' as const),
          }
        : notification.subject,
    };
  });

  return {
    loadingNotifications,
    targetKeys,
    targets: Array.from(targetsByKey.values()),
  };
};

const chunkTargets = (targets: NotificationSubjectEnrichmentTarget[]) => {
  const chunks: NotificationSubjectEnrichmentTarget[][] = [];
  for (let index = 0; index < targets.length; index += subjectEnrichmentChunkSize) {
    chunks.push(targets.slice(index, index + subjectEnrichmentChunkSize));
  }
  return chunks;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string';

const toValidResult = (
  target: NotificationSubjectEnrichmentTarget,
  value: unknown
): NotificationSubjectEnrichmentResult | null => {
  if (!isRecord(value) || value.key !== target.key) return null;
  if (typeof value.title !== 'string' || value.title.trim().length === 0) return null;
  if (!isOptionalString(value.updatedAt)) return null;
  if (!isOptionalString(value.authorLogin) || !isOptionalString(value.authorAvatarUrl)) return null;
  if (value.draft !== undefined && typeof value.draft !== 'boolean') return null;
  if (value.isAnswered !== undefined && typeof value.isAnswered !== 'boolean') return null;

  const state = value.state;
  if (target.type === 'discussions') {
    if (typeof value.isAnswered !== 'boolean') return null;
  } else if (state !== 'open' && state !== 'closed' && state !== 'merged') {
    return null;
  }

  const issueType = value.issueType;
  if (
    issueType !== undefined &&
    (!isRecord(issueType) ||
      typeof issueType.name !== 'string' ||
      (issueType.color !== null &&
        issueType.color !== undefined &&
        typeof issueType.color !== 'string'))
  ) {
    return null;
  }

  const labels = value.labels;
  if (
    labels !== undefined &&
    (!Array.isArray(labels) ||
      labels.some(
        (label) =>
          !isRecord(label) || typeof label.name !== 'string' || typeof label.color !== 'string'
      ))
  ) {
    return null;
  }

  const comments = value.comments;
  if (
    comments !== undefined &&
    (typeof comments !== 'number' || !Number.isSafeInteger(comments) || comments < 0)
  ) {
    return null;
  }

  const linkedSummary =
    target.type === 'issues'
      ? readLinkedPullRequestListSummary(value.linkedPullRequestCount, value.linkedPullRequest)
      : null;
  if (target.type === 'issues' && value.linkedPullRequestCount !== undefined && !linkedSummary) {
    return null;
  }

  return {
    key: target.key,
    title: value.title,
    updatedAt: value.updatedAt as string | undefined,
    state: state as NotificationSubjectEnrichmentResult['state'],
    draft: value.draft as boolean | undefined,
    isAnswered: value.isAnswered as boolean | undefined,
    issueType: issueType as NotificationSubjectEnrichmentResult['issueType'],
    labels: labels as NotificationSubjectEnrichmentResult['labels'],
    comments: comments as number | undefined,
    authorLogin: value.authorLogin as string | undefined,
    authorAvatarUrl: value.authorAvatarUrl as string | undefined,
    ...(linkedSummary
      ? {
          linkedPullRequestCount: linkedSummary.count,
          linkedPullRequest: linkedSummary.identity ?? undefined,
        }
      : {}),
  };
};

const mergeEnrichmentResults = (
  loadingNotifications: DashboardNotification[],
  targetKeys: Array<string | null>,
  resultsByKey: Map<string, NotificationSubjectEnrichmentResult>
) => {
  return loadingNotifications.map((notification, index) => {
    const targetKey = targetKeys[index];
    if (!targetKey || !notification.subject) return notification;

    const result = resultsByKey.get(targetKey);
    if (!result) {
      return {
        ...notification,
        subject: {
          ...notification.subject,
          stateStatus: 'error' as const,
        },
      };
    }

    const {
      linkedPullRequestCount: _previousCount,
      linkedPullRequest: _previousIdentity,
      ...subjectWithoutLinkedPullRequests
    } = notification.subject;

    return {
      ...notification,
      updated_at: result.updatedAt ?? notification.updated_at,
      subject: {
        ...subjectWithoutLinkedPullRequests,
        title: result.title,
        state: result.state,
        draft: result.draft,
        isAnswered: result.isAnswered,
        issueType: result.issueType,
        labels: result.labels,
        comments: result.comments,
        authorLogin: result.authorLogin,
        authorAvatarUrl: result.authorAvatarUrl,
        ...(result.linkedPullRequestCount !== undefined
          ? {
              linkedPullRequestCount: result.linkedPullRequestCount,
              linkedPullRequest: result.linkedPullRequest,
            }
          : {}),
        stateStatus: 'loaded' as const,
      },
    };
  });
};

export function createNotificationSubjectEnrichmentSession({
  adapter,
  parseSubject,
}: NotificationSubjectEnrichmentComposition) {
  let generation = 0;

  const start = (notifications: DashboardNotification[]): NotificationSubjectEnrichmentRun => {
    const runGeneration = ++generation;
    const { loadingNotifications, targetKeys, targets } = createLoadingNotifications(
      notifications,
      parseSubject
    );

    const completion = (async (): Promise<NotificationSubjectEnrichmentOutcome> => {
      await Promise.resolve();

      if (runGeneration !== generation) {
        return { outcome: 'stale' };
      }

      if (targets.length === 0) {
        return {
          outcome: 'not-needed',
          notifications: loadingNotifications,
        };
      }

      const chunks = chunkTargets(targets);
      const settledChunks = await Promise.allSettled(chunks.map((chunk) => adapter.load(chunk)));

      if (runGeneration !== generation) {
        return { outcome: 'stale' };
      }

      const resultsByKey = new Map<string, NotificationSubjectEnrichmentResult>();
      const invalidResultKeys = new Set<string>();

      settledChunks.forEach((settledChunk, chunkIndex) => {
        if (settledChunk.status === 'rejected' || !Array.isArray(settledChunk.value)) return;

        const chunk = chunks[chunkIndex] ?? [];
        const targetsByKey = new Map(chunk.map((target) => [target.key, target]));
        for (const value of settledChunk.value) {
          const key = isRecord(value) && typeof value.key === 'string' ? value.key : null;
          const target = key ? targetsByKey.get(key) : undefined;
          if (!target || invalidResultKeys.has(target.key)) continue;

          if (resultsByKey.has(target.key)) {
            resultsByKey.delete(target.key);
            invalidResultKeys.add(target.key);
            continue;
          }

          const result = toValidResult(target, value);
          if (result) {
            resultsByKey.set(target.key, result);
          }
        }
      });

      const loadedTargetCount = resultsByKey.size;
      const errorTargetCount = targets.length - loadedTargetCount;
      const outcome =
        errorTargetCount === 0 ? 'complete' : loadedTargetCount === 0 ? 'failed' : 'partial';

      return {
        outcome,
        notifications: mergeEnrichmentResults(loadingNotifications, targetKeys, resultsByKey),
      };
    })();

    return {
      notifications: loadingNotifications,
      completion,
    };
  };

  return { start };
}
