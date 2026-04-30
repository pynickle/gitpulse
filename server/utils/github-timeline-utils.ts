import type { Octokit } from '@octokit/core';

type GitHubClient = Octokit;

export interface TimelineWarning {
  code: string;
  scope: string;
  message: string;
}

export interface TimelineCapabilities {
  source: 'rest';
  supportsHistoricalReviewRequests: boolean;
  supportsReviewThreads: 'full' | 'partial' | 'none';
  supportsReferenceSubjects: 'full' | 'partial' | 'minimal';
}

export interface TimelineErrorDescriptor {
  code: string;
  scope: string;
  retryable: boolean;
}

export interface TimelinePayload<T> {
  timeline: T[];
  warnings: TimelineWarning[];
  errors: TimelineErrorDescriptor[];
  capabilities: TimelineCapabilities;
}

interface TimelineCommitPayload {
  oid?: string;
  message?: string;
  messageHeadlineHTML?: string;
  url?: string;
  commitUrl?: string;
  committedDate?: string;
  author?: {
    name?: string;
    user?: ReturnType<typeof mapActor>;
  };
}

interface SortableTimelineItem {
  kind: string;
  eventType?: string;
  id?: string;
  createdAt?: string;
  timelineSource?: string;
  commit?: TimelineCommitPayload;
  [key: string]: unknown;
}

type BaseTimelineItem = Omit<SortableTimelineItem, 'kind'>;

interface RestUserLike {
  login?: string;
  avatar_url?: string;
  html_url?: string;
  url?: string;
  name?: string;
  slug?: string;
  type?: string;
}

interface TimelineRepoContext {
  owner: string;
  repo: string;
}

const ISSUE_UNSUPPORTED_EVENT_CLASSES = [
  'project_v2_field_history',
  'issue_type_history',
  'sub_issue_relationships',
  'blocking_relationships',
  'duplicate_relationships',
  'discussion_conversion_details',
  'comment_deletion_audit',
] as const;

const PR_UNSUPPORTED_EVENT_CLASSES = [
  'historical_review_requests',
  'review_thread_resolution_history',
  'auto_merge_history',
  'merge_queue_history',
  'branch_force_push_history',
  'blocking_relationships',
  'duplicate_relationships',
  'parent_sub_issue_relationships',
  'project_v2_field_history',
] as const;

export function buildIssueTimelineCapabilities(): TimelineCapabilities {
  return {
    source: 'rest',
    supportsHistoricalReviewRequests: false,
    supportsReviewThreads: 'none',
    supportsReferenceSubjects: 'partial',
  };
}

export function buildPRTimelineCapabilities(): TimelineCapabilities {
  return {
    source: 'rest',
    supportsHistoricalReviewRequests: false,
    supportsReviewThreads: 'partial',
    supportsReferenceSubjects: 'partial',
  };
}

export function createUnsupportedWarnings(scope: 'issue' | 'pull'): TimelineWarning[] {
  const eventClasses =
    scope === 'issue' ? ISSUE_UNSUPPORTED_EVENT_CLASSES : PR_UNSUPPORTED_EVENT_CLASSES;

  return eventClasses.map((eventClass) => ({
    code: 'unsupported_event_class',
    scope,
    message: `${eventClass} is not fully available from GitHub REST timeline APIs and will be degraded.`,
  }));
}

export function createSubrequestWarning(scope: string, error: unknown): TimelineWarning {
  return {
    code: getTimelineErrorCode(error),
    scope,
    message: getTimelineErrorMessage(error, scope),
  };
}

export function createSubrequestError(scope: string, error: unknown): TimelineErrorDescriptor {
  return {
    code: getTimelineErrorCode(error),
    scope,
    retryable: isRetryableGitHubError(error),
  };
}

export function throwTimelineFatalError(error: unknown, fallbackMessage: string): never {
  const statusCode = getTimelineStatusCode(error);

  throw createError({
    statusCode,
    statusMessage: getTimelineErrorMessage(error, fallbackMessage),
  });
}

export async function fetchPaginatedArray<T>(
  octokit: GitHubClient,
  route: string,
  params: Record<string, unknown>,
  perPage = 100
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.request(route, {
      ...params,
      per_page: perPage,
      page,
    });

    const pageItems = Array.isArray(response.data) ? (response.data as T[]) : [];
    results.push(...pageItems);

    if (pageItems.length < perPage) {
      return results;
    }

    page += 1;
  }
}

export async function fetchTimelinePage<T>(
  octokit: GitHubClient,
  route: string,
  params: Record<string, unknown>,
  page: number,
  perPage = 100
): Promise<{ items: T[]; hasNextPage: boolean }> {
  const response = await octokit.request(route, {
    ...params,
    per_page: perPage,
    page,
  });

  const items = Array.isArray(response.data) ? (response.data as T[]) : [];

  const linkHeader =
    (response.headers && (response.headers.link ?? (response.headers as any).Link)) ?? '';
  const hasNextPageByLink = typeof linkHeader === 'string' && linkHeader.includes('rel="next"');
  const hasNextPage = hasNextPageByLink || items.length === perPage;

  return { items, hasNextPage };
}

export function sortTimelineItems<T extends SortableTimelineItem>(timeline: T[]): T[] {
  return [...timeline].sort((left, right) => {
    const leftRecord = left as { createdAt?: string; commit?: { committedDate?: string } };
    const rightRecord = right as { createdAt?: string; commit?: { committedDate?: string } };
    const leftDate =
      Date.parse(leftRecord.createdAt ?? leftRecord.commit?.committedDate ?? '') || 0;
    const rightDate =
      Date.parse(rightRecord.createdAt ?? rightRecord.commit?.committedDate ?? '') || 0;

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return 0;
  });
}

export function normalizeIssueTimelineEvent(
  rawEvent: Record<string, any>,
  context: TimelineRepoContext
): SortableTimelineItem {
  const eventName = String(rawEvent.event ?? 'unknown');
  const baseItem = buildBaseTimelineItem(rawEvent);

  switch (eventName) {
    case 'commented':
      return {
        ...baseItem,
        kind: 'comment',
        eventType: eventName,
        author: mapActor(rawEvent.actor ?? rawEvent.user),
        body: rawEvent.body ?? '',
        url: rawEvent.html_url,
      };
    case 'cross-referenced':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        source: mapReferencedSource(rawEvent.source, context),
        willCloseTarget: Boolean(rawEvent.source?.issue?.pull_request?.merged_at),
        degraded: !rawEvent.source,
        displayText: rawEvent.source
          ? undefined
          : 'referenced this issue from a resource that is no longer fully visible',
      };
    case 'connected':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        source: mapReference(rawEvent.source?.issue ?? rawEvent.source, context),
        subject: mapReference(rawEvent.subject?.issue ?? rawEvent.subject, context),
      };
    case 'disconnected':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        source: mapReference(rawEvent.source?.issue ?? rawEvent.source, context),
        subject: mapReference(rawEvent.subject?.issue ?? rawEvent.subject, context),
      };
    case 'assigned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        assignee: mapActor(rawEvent.assignee),
      };
    case 'unassigned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        assignee: mapActor(rawEvent.assignee),
      };
    case 'labeled':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        label: mapLabel(rawEvent.label),
      };
    case 'unlabeled':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        label: mapLabel(rawEvent.label),
      };
    case 'milestoned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        milestoneTitle: rawEvent.milestone?.title,
      };
    case 'demilestoned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        milestoneTitle: rawEvent.milestone?.title,
      };
    case 'renamed':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        previousTitle: rawEvent.rename?.from,
        currentTitle: rawEvent.rename?.to,
      };
    case 'locked':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        lockReason: rawEvent.lock_reason,
      };
    case 'unlocked':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
      };
    case 'closed':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        stateReason: rawEvent.state_reason,
      };
    case 'reopened':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
      };
    case 'pinned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
      };
    case 'unpinned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
      };
    case 'referenced':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        commit: {
          oid: rawEvent.commit_id,
          commitUrl: rawEvent.commit_url,
          url: rawEvent.commit_url,
          messageHeadlineHTML: rawEvent.commit_id
            ? `Referenced by commit <code>${rawEvent.commit_id.slice(0, 7)}</code>`
            : undefined,
        },
        degraded: !rawEvent.commit_id,
      };
    case 'moved_columns_in_project':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        previousProjectColumnName: rawEvent.previous_column_name,
        projectColumnName: rawEvent.project_card?.column_name ?? rawEvent.column_name,
      };
    case 'added_to_project':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        project: mapProject(rawEvent.project_card?.project_url, rawEvent.project_card?.project_id),
        projectColumnName: rawEvent.project_card?.column_name,
      };
    case 'removed_from_project':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        project: mapProject(rawEvent.project_card?.project_url, rawEvent.project_card?.project_id),
        projectColumnName: rawEvent.project_card?.column_name,
      };
    case 'converted_note_to_issue':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
      };
    case 'converted_to_discussion':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        discussion: {
          title: rawEvent.discussion?.title ?? rawEvent.title,
        },
      };
    case 'mentioned':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
      };
    case 'marked_as_duplicate':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        duplicate: mapReference(rawEvent.duplicate ?? rawEvent.canonical, context),
      };
    case 'unmarked_as_duplicate':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        duplicate: mapReference(rawEvent.duplicate ?? rawEvent.canonical, context),
      };
    case 'transferred':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        fromRepository: mapTransferredRepository(rawEvent, context),
      };
    case 'user_blocked':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        subject: mapBlockedSubject(rawEvent.blocked_user ?? rawEvent.subject ?? rawEvent.user),
      };
    case 'merged':
      return {
        ...baseItem,
        kind: 'event',
        eventType: eventName,
        commit: {
          oid: rawEvent.commit_id,
          commitUrl: rawEvent.commit_url,
          url: rawEvent.commit_url,
        },
      };
    case 'committed':
      return {
        ...baseItem,
        kind: 'commit',
        eventType: eventName,
        commit: mapCommitPayload(rawEvent),
      };
    default:
      return createUnsupportedRestEvent(baseItem, eventName, 'issue');
  }
}

export function normalizePRIssueTimelineEvent(
  rawEvent: Record<string, any>,
  context: TimelineRepoContext
): SortableTimelineItem {
  const eventName = String(rawEvent.event ?? 'unknown');

  switch (eventName) {
    case 'review_requested':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        requestedReviewer: mapRequestedReviewer(
          rawEvent.requested_reviewer ?? rawEvent.requested_team
        ),
      };
    case 'review_request_removed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        requestedReviewer: mapRequestedReviewer(
          rawEvent.requested_reviewer ?? rawEvent.requested_team
        ),
      };
    case 'review_dismissed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        review: {
          author: mapActor(
            rawEvent.dismissed_review?.review?.user ??
              rawEvent.dismissed_review?.user ??
              rawEvent.review?.user
          ),
          state:
            rawEvent.dismissed_review?.review?.state ??
            rawEvent.dismissed_review?.state ??
            rawEvent.review?.state,
        },
      };
    case 'convert_to_draft':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
      };
    case 'ready_for_review':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
      };
    case 'head_ref_deleted':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        ref: {
          name: rawEvent.head_ref ?? rawEvent.ref?.name,
        },
      };
    case 'head_ref_restored':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        ref: {
          name: rawEvent.head_ref ?? rawEvent.ref?.name,
        },
      };
    case 'head_ref_force_pushed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        ref: {
          name: rawEvent.head_ref ?? rawEvent.ref?.name,
        },
        beforeCommit: mapOptionalCommit(rawEvent.before_commit_id, rawEvent.before_commit_url),
        afterCommit: mapOptionalCommit(rawEvent.after_commit_id, rawEvent.after_commit_url),
      };
    case 'base_ref_changed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        previousRefName: rawEvent.previous_base_ref_name ?? rawEvent.previous_ref_name,
        currentRefName:
          rawEvent.current_base_ref_name ?? rawEvent.current_ref_name ?? rawEvent.base_ref,
      };
    case 'automatic_base_change_succeeded':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        oldBase: rawEvent.previous_base_ref_name ?? rawEvent.old_base,
        newBase: rawEvent.current_base_ref_name ?? rawEvent.new_base ?? rawEvent.base_ref,
      };
    case 'automatic_base_change_failed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        oldBase: rawEvent.previous_base_ref_name ?? rawEvent.old_base,
        newBase: rawEvent.current_base_ref_name ?? rawEvent.new_base ?? rawEvent.base_ref,
      };
    case 'deployed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        deployment: {
          environment: rawEvent.deployment?.environment ?? rawEvent.environment,
        },
      };
    case 'deployment_environment_changed':
      return {
        ...buildBaseTimelineItem(rawEvent),
        kind: 'event',
        eventType: eventName,
        deploymentStatus: {
          environment: rawEvent.deployment_status?.environment ?? rawEvent.environment,
        },
      };
  }

  return normalizeIssueTimelineEvent(rawEvent, context);
}

export function normalizePRTimelineEvent(
  rawEvent: Record<string, any>,
  context: TimelineRepoContext
): SortableTimelineItem[] {
  const eventName = String(rawEvent.event ?? 'unknown');

  switch (eventName) {
    case 'reviewed':
      return [normalizePRReviewEvent(rawEvent)];
    case 'line_commented':
      return normalizePRReviewCommentEvents(rawEvent);
    case 'commit_commented':
      return normalizePRCommitCommentEvents(rawEvent);
    case 'committed':
      return [normalizePRCommitEvent(rawEvent)];
    default:
      return [normalizePRIssueTimelineEvent(rawEvent, context)];
  }
}

function normalizePRReviewEvent(review: Record<string, any>): SortableTimelineItem {
  return {
    kind: 'review',
    eventType: String(review.event ?? 'reviewed'),
    id: stringifyId(review.id ?? review.node_id),
    createdAt: review.submitted_at ?? review.created_at,
    author: mapActor(review.user ?? review.actor),
    body: review.body ?? review.review?.body ?? '',
    state: review.state ?? review.review?.state,
    url: review.html_url,
    timelineSource: 'rest.timeline',
  };
}

function normalizePRReviewCommentEvents(rawEvent: Record<string, any>): SortableTimelineItem[] {
  const comments = Array.isArray(rawEvent.comments) ? rawEvent.comments : [];

  if (!comments.length) {
    return [
      {
        ...buildBaseTimelineItem(rawEvent),
        kind: rawEvent.body ? 'review-comment' : 'event',
        eventType: 'line_commented',
        actor: mapActor(rawEvent.actor ?? rawEvent.user),
        author: mapActor(rawEvent.actor ?? rawEvent.user),
        body: rawEvent.body ?? '',
        path: rawEvent.path,
        url: rawEvent.html_url,
        isResolved: false,
        isOutdated: false,
        displayText: 'commented on a review thread',
        diffHunk: rawEvent.diff_hunk,
        timelineSource: 'rest.timeline',
      },
    ];
  }

  return comments.map((comment: Record<string, any>) => ({
    kind: 'review-comment',
    eventType: 'line_commented',
    id: stringifyId(comment.id ?? comment.node_id),
    createdAt: comment.created_at ?? rawEvent.created_at,
    actor: mapActor(comment.user ?? rawEvent.actor),
    author: mapActor(comment.user ?? rawEvent.actor),
    body: comment.body ?? '',
    path: comment.path ?? rawEvent.path,
    url: comment.html_url,
    originalUrl: comment.html_url,
    pullRequestReviewUrl: comment.pull_request_review_url,
    diffHunk: comment.diff_hunk,
    isResolved: false,
    isOutdated: false,
    timelineSource: 'rest.timeline',
  }));
}

function normalizePRCommitCommentEvents(rawEvent: Record<string, any>): SortableTimelineItem[] {
  const comments = Array.isArray(rawEvent.comments) ? rawEvent.comments : [];

  if (!comments.length) {
    return [
      {
        ...buildBaseTimelineItem(rawEvent),
        kind: rawEvent.body ? 'review-comment' : 'event',
        eventType: 'commit_commented',
        actor: mapActor(rawEvent.actor ?? rawEvent.user),
        author: mapActor(rawEvent.actor ?? rawEvent.user),
        body: rawEvent.body ?? '',
        path: rawEvent.path,
        url: rawEvent.html_url,
        commit: mapCommitPayload(rawEvent),
        displayText: 'commented on a commit in this PR',
        diffHunk: rawEvent.diff_hunk,
        timelineSource: 'rest.timeline',
      },
    ];
  }

  return comments.map((comment: Record<string, any>) => ({
    kind: 'review-comment',
    eventType: 'commit_commented',
    id: stringifyId(comment.id ?? comment.node_id),
    createdAt: comment.created_at ?? rawEvent.created_at,
    actor: mapActor(comment.user ?? rawEvent.actor),
    author: mapActor(comment.user ?? rawEvent.actor),
    body: comment.body ?? '',
    path: comment.path ?? rawEvent.path,
    url: comment.html_url,
    commit: mapCommitPayload({
      ...rawEvent,
      sha: comment.commit_id ?? rawEvent.commit_id,
      html_url: comment.html_url ?? rawEvent.html_url,
    }),
    diffHunk: comment.diff_hunk,
    isResolved: false,
    isOutdated: false,
    timelineSource: 'rest.timeline',
  }));
}

function normalizePRCommitEvent(commit: Record<string, any>): SortableTimelineItem {
  return {
    kind: 'commit',
    eventType: String(commit.event ?? 'committed'),
    id: stringifyId(commit.sha),
    timelineSource: 'rest.timeline',
    commit: mapCommitPayload(commit),
  };
}

function buildBaseTimelineItem(rawEvent: Record<string, any>): BaseTimelineItem {
  return {
    id: stringifyId(rawEvent.id ?? rawEvent.node_id),
    createdAt: rawEvent.created_at,
    actor: mapActor(rawEvent.actor),
    timelineSource: 'rest.timeline',
  };
}

function createUnsupportedRestEvent(
  baseItem: Record<string, any>,
  eventName: string,
  scope: 'issue' | 'pull'
) {
  return {
    ...baseItem,
    kind: 'unsupported',
    eventType: eventName,
    degraded: true,
    displayText: `GitHub REST does not fully expose the ${eventName} ${scope} event; showing a degraded entry instead.`,
    restEvent: eventName,
  };
}

function mapActor(user: RestUserLike | undefined | null) {
  if (!user) return undefined;

  return {
    resourceType: user.type,
    login: user.login,
    avatarUrl: user.avatar_url,
    url: user.html_url ?? user.url,
    name: user.name,
    slug: user.slug,
  };
}

function mapLabel(label: Record<string, any> | undefined | null) {
  if (!label) return undefined;

  return {
    name: label.name,
    color: label.color,
  };
}

function mapProject(projectUrl?: string, projectId?: number | string) {
  if (!projectUrl && !projectId) {
    return undefined;
  }

  return {
    title: projectId ? `Project ${projectId}` : 'Project',
    name: projectId ? `Project ${projectId}` : 'Project',
    url: projectUrl,
  };
}

function mapRequestedReviewer(reviewer: Record<string, any> | undefined | null) {
  if (!reviewer) return undefined;

  return {
    resourceType: reviewer.type,
    login: reviewer.login,
    name: reviewer.name,
    slug: reviewer.slug,
    avatarUrl: reviewer.avatar_url,
    url: reviewer.html_url ?? reviewer.url,
  };
}

function mapOptionalCommit(commitId?: string, commitUrl?: string) {
  if (!commitId && !commitUrl) {
    return undefined;
  }

  return {
    oid: commitId,
    commitUrl,
    url: commitUrl,
  };
}

function mapTransferredRepository(rawEvent: Record<string, any>, context: TimelineRepoContext) {
  const fromRepository = rawEvent.from_repository ?? rawEvent.repository;

  if (!fromRepository) {
    return {
      name: context.repo,
      nameWithOwner: `${context.owner}/${context.repo}`,
      owner: {
        login: context.owner,
      },
      url: `https://github.com/${context.owner}/${context.repo}`,
    };
  }

  return {
    name: fromRepository.name,
    nameWithOwner: fromRepository.full_name,
    owner: {
      login: fromRepository.owner?.login,
    },
    url: fromRepository.html_url,
  };
}

function mapBlockedSubject(user: RestUserLike | undefined | null) {
  if (!user) return undefined;

  return {
    login: user.login,
    url: user.html_url ?? user.url,
  };
}

function mapReferencedSource(
  source: Record<string, any> | undefined,
  context: TimelineRepoContext
) {
  if (!source) return undefined;

  const issue = source.issue ?? source.pull_request ?? source;
  return mapReference(issue, context);
}

function mapReference(item: Record<string, any> | undefined, context: TimelineRepoContext) {
  if (!item) return undefined;

  const repository = mapRepository(item, context);

  return {
    resourceType:
      item.pull_request || String(item.html_url ?? '').includes('/pull/')
        ? 'pull-request'
        : 'issue',
    number: item.number,
    title: item.title ?? item.issue?.title,
    url: item.html_url,
    state: item.state,
    repository,
  };
}

function mapCommitPayload(commit: Record<string, any>) {
  return {
    oid: commit.sha ?? commit.commit_id,
    message: commit.commit?.message ?? commit.message,
    url: commit.html_url ?? commit.commit_url,
    commitUrl: commit.html_url ?? commit.commit_url,
    committedDate:
      commit.commit?.author?.date ??
      commit.author?.date ??
      commit.committer?.date ??
      commit.created_at,
    author: {
      name: commit.commit?.author?.name ?? commit.author?.name,
      user: mapActor(commit.author_user ?? commit.author ?? commit.user ?? commit.actor),
    },
  };
}

function mapRepository(item: Record<string, any>, context: TimelineRepoContext) {
  const htmlUrl = typeof item.html_url === 'string' ? item.html_url : '';
  const repoMatch = htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)\//);

  return {
    name: item.repository?.name ?? repoMatch?.[2] ?? context.repo,
    nameWithOwner:
      item.repository?.full_name ??
      (repoMatch?.[1] && repoMatch?.[2]
        ? `${repoMatch[1]}/${repoMatch[2]}`
        : `${context.owner}/${context.repo}`),
    owner: {
      login: item.repository?.owner?.login ?? repoMatch?.[1] ?? context.owner,
    },
  };
}

function stringifyId(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function getTimelineStatusCode(error: unknown) {
  const status = Number((error as { status?: number })?.status);
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status === 404) return 404;
  return 500;
}

function getTimelineErrorCode(error: unknown) {
  const statusCode = getTimelineStatusCode(error);

  switch (statusCode) {
    case 401:
      return 'auth_required';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found_or_invisible';
    default:
      return 'upstream_failure';
  }
}

function getTimelineErrorMessage(error: unknown, fallbackMessage: string) {
  const message = (error as { message?: string })?.message;
  return message || fallbackMessage;
}

function isRetryableGitHubError(error: unknown) {
  const statusCode = getTimelineStatusCode(error);
  return statusCode >= 500;
}
