import { computed, toValue, type MaybeRefOrGetter } from 'vue';

import type { ReactionSummaryItem } from '#shared/types/reactions';
import type {
  TimelineActor,
  TimelineCommit,
  TimelineLabel,
  TimelineProject,
  TimelineReference,
  TimelineRepository,
  TimelineRequestedReviewer,
  TimelineStateChange,
} from '~/composables/usePRTimelineEvents';

export interface IssueTimelineItem {
  kind: 'comment' | 'event' | 'commit' | 'unsupported';
  eventType?: string;
  id?: string;
  createdAt?: string;
  body?: string;
  url?: string;
  reactions?: ReactionSummaryItem[];
  timelineSource?: string;
  degraded?: boolean;
  displayText?: string;
  actor?: TimelineActor;
  author?: TimelineActor;
  hasMixedActors?: boolean;
  commit?: TimelineCommit & { messageHeadlineHTML?: string };
  label?: TimelineLabel;
  labelChanges?: TimelineStateChange[];
  project?: TimelineProject;
  assignee?: TimelineRequestedReviewer;
  assigneeChanges?: TimelineStateChange[];
  deletedCommentAuthor?: { login?: string };
  discussion?: { title?: string };
  source?: TimelineReference;
  subject?: (TimelineReference & { login?: string }) | null;
  otherTarget?: TimelineReference | null;
  duplicate?: TimelineReference;
  parent?: TimelineReference;
  blockedIssue?: TimelineReference;
  subIssue?: TimelineReference;
  fromRepository?: TimelineRepository & { url?: string };
  previousStatus?: string;
  status?: string;
  previousTitle?: string;
  currentTitle?: string;
  lockReason?: string | null;
  stateReason?: string | null;
  milestoneTitle?: string;
  previousProjectColumnName?: string;
  projectColumnName?: string;
  restEvent?: string;
}

export interface ProcessedIssueTimelineItem extends IssueTimelineItem {
  renderKey: string;
  otherTarget?: TimelineReference | null;
}

export interface IssueTimelineContext {
  repoOwner: string;
  repoName: string;
  issueNumber: number;
}

const withLowercaseAliases = (entries: Record<string, string>): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(entries).flatMap(([reason, value]) => [
      [reason, value],
      [reason.toLowerCase(), value],
    ])
  );
};

const lockReasonMap = withLowercaseAliases({
  OFF_TOPIC: 'Off Topic',
  RESOLVED: 'Resolved',
  SPAM: 'Spam',
  TOO_HEATED: 'Too Heated',
});

const stateReasonMap = withLowercaseAliases({
  COMPLETED: 'Completed',
  DUPLICATE: 'Duplicate',
  NOT_PLANNED: 'Not Planned',
  REOPENED: 'Reopened',
});

const stateReasonClassMap = withLowercaseAliases({
  COMPLETED: 'is-success',
  DUPLICATE: 'is-link',
  NOT_PLANNED: 'is-warning',
  REOPENED: 'is-primary',
});

const ISSUE_TYPE_EVENTS = ['issue_type_added', 'issue_type_changed', 'issue_type_removed'];

export function formatLockReason(lockReason: string | undefined | null): string {
  if (!lockReason) return '';
  return lockReasonMap[lockReason] || lockReason;
}

export function formatStateReason(stateReason: string | undefined | null): string {
  if (!stateReason) return '';
  return stateReasonMap[stateReason] || stateReason;
}

export function getStateReasonClass(stateReason: string | undefined | null): string {
  if (!stateReason) return 'is-info';
  return stateReasonClassMap[stateReason] || 'is-info';
}

export function isIssueTypeEvent(eventType?: string): boolean {
  return Boolean(eventType && ISSUE_TYPE_EVENTS.includes(eventType));
}

function isSameTarget(
  target: TimelineReference | undefined,
  owner: string,
  repo: string,
  number: number
) {
  return (
    target?.repository?.owner?.login === owner &&
    target?.repository?.name === repo &&
    target?.number === number
  );
}

function getOtherTarget(
  item: IssueTimelineItem,
  context: IssueTimelineContext
): TimelineReference | null {
  const { source, subject } = item;

  if (isSameTarget(source, context.repoOwner, context.repoName, context.issueNumber)) {
    return subject ?? null;
  }

  if (
    isSameTarget(subject ?? undefined, context.repoOwner, context.repoName, context.issueNumber)
  ) {
    return source ?? null;
  }

  return null;
}

export function buildIssueTimelineItemKey(item: IssueTimelineItem, index: number): string {
  if (item.id) return item.id;
  if (item.commit?.oid) return `issue-commit-${item.commit.oid}`;

  const actor = item.actor?.login ?? item.author?.login ?? 'unknown';
  const createdAt = item.createdAt ?? 'no-date';
  const number = item.source?.number ?? item.blockedIssue?.number ?? item.parent?.number ?? index;

  return `${item.kind}-${item.eventType ?? 'unknown'}-${createdAt}-${actor}-${number}`;
}

export function normalizeIssueTimelineItems(
  timeline: IssueTimelineItem[],
  context: IssueTimelineContext
): ProcessedIssueTimelineItem[] {
  return timeline
    .filter((item) => !isIssueTypeEvent(item.eventType))
    .map((item, index) => ({
      ...item,
      otherTarget:
        item.eventType === 'connected' || item.eventType === 'disconnected'
          ? getOtherTarget(item, context)
          : item.otherTarget,
      renderKey: buildIssueTimelineItemKey(item, index),
    }));
}

export function useIssueTimelineEvents(
  timeline: MaybeRefOrGetter<IssueTimelineItem[]>,
  context: MaybeRefOrGetter<IssueTimelineContext>
) {
  const processedTimeline = computed(() =>
    normalizeIssueTimelineItems(toValue(timeline), toValue(context))
  );

  return {
    processedTimeline,
  };
}
