import { computed, toValue, type MaybeRefOrGetter } from 'vue';

export interface TimelineActor {
  resourceType?: string;
  login?: string;
  avatarUrl?: string;
  url?: string;
  name?: string;
  slug?: string;
}

export interface TimelineRepository {
  name?: string;
  nameWithOwner?: string;
  owner?: {
    login?: string;
  };
}

export interface TimelineReference {
  resourceType?: 'issue' | 'pull-request';
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  repository?: TimelineRepository;
}

export interface TimelineLabel {
  name?: string;
  color?: string;
}

export interface TimelineCommit {
  oid?: string;
  message?: string;
  url?: string;
  commitUrl?: string;
  committedDate?: string;
  author?: {
    name?: string;
    user?: TimelineActor;
  };
}

export interface TimelineReviewDismissal {
  actor?: TimelineActor;
  createdAt?: string;
  message?: string;
  commitId?: string;
  previousState?: string;
}

export interface TimelineRequestedReviewer {
  resourceType?: string;
  login?: string;
  name?: string;
  slug?: string;
  avatarUrl?: string;
  url?: string;
}

export interface TimelineProject {
  title?: string;
  url?: string;
  name?: string;
}

export interface PRTimelineItem {
  kind: 'comment' | 'event' | 'review' | 'review-comment' | 'commit' | 'unsupported';
  eventType?: string;
  id?: string;
  createdAt?: string;
  timelineSource?: string;
  degraded?: boolean;
  displayText?: string;
  body?: string;
  url?: string;
  state?: string;
  actor?: TimelineActor;
  author?: TimelineActor;
  assignee?: TimelineRequestedReviewer;
  enqueuer?: TimelineActor;
  mergeQueue?: { id?: string };
  project?: TimelineProject;
  projectColumnName?: string;
  milestoneTitle?: string;
  source?: TimelineReference;
  subject?: TimelineReference & { login?: string };
  blockingIssue?: TimelineReference;
  blockedIssue?: TimelineReference;
  canonical?: TimelineReference;
  duplicate?: TimelineReference;
  parent?: TimelineReference;
  subIssue?: TimelineReference;
  fromRepository?: TimelineRepository & { url?: string };
  label?: TimelineLabel;
  lockReason?: string;
  stateReason?: string;
  currentRefName?: string;
  previousRefName?: string;
  oldBase?: string;
  newBase?: string;
  baseRefName?: string;
  discussion?: { title?: string };
  deployment?: { environment?: string };
  deploymentStatus?: { environment?: string };
  prevIssueType?: { name?: string };
  issueType?: { name?: string };
  previousProjectColumnName?: string;
  previousStatus?: string;
  status?: string;
  review?: {
    id?: string;
    author?: TimelineActor;
    state?: string;
    dismissalMessage?: string;
    dismissalCommitId?: string;
  };
  reviewId?: string;
  commitId?: string;
  dismissal?: TimelineReviewDismissal;
  requestedReviewer?: TimelineRequestedReviewer;
  deletedCommentAuthor?: { login?: string };
  commit?: TimelineCommit;
  beforeCommit?: TimelineCommit;
  afterCommit?: TimelineCommit;
  ref?: { name?: string };
  isResolved?: boolean;
  isOutdated?: boolean;
  path?: string;
  resolvedBy?: TimelineActor;
  currentTitle?: string;
  previousTitle?: string;
  reason?: string;
  reasonCode?: string;
  restEvent?: string;
  projectCard?: { project?: TimelineProject };
  issueField?: { resourceType?: string; name?: string };
  originalUrl?: string;
  pullRequestReviewUrl?: string;
  diffHunk?: string;
}

export interface ProcessedPRTimelineItem extends PRTimelineItem {
  renderKey: string;
}

export function buildPRTimelineItemKey(item: PRTimelineItem, index: number): string {
  if (item.id) return item.id;
  if (item.commit?.oid) return `commit-${item.commit.oid}`;

  const actor = item.actor?.login ?? item.author?.login ?? 'unknown';
  const createdAt = item.createdAt ?? item.commit?.committedDate ?? 'no-date';
  const number =
    item.source?.number ?? item.blockingIssue?.number ?? item.blockedIssue?.number ?? index;

  return `${item.kind}-${item.eventType ?? 'unknown'}-${createdAt}-${actor}-${number}`;
}

export function normalizePRTimelineItems(timeline: PRTimelineItem[]): ProcessedPRTimelineItem[] {
  return timeline
    .filter((item, index, array) => {
      // Skip "closed" events that immediately follow a "merged" event —
      // merge always implies close, so the redundant close is noise.
      if (item.eventType === 'closed' && index > 0) {
        const prev = array[index - 1];
        if (
          prev?.eventType === 'merged' &&
          prev.actor?.login === item.actor?.login &&
          prev.createdAt === item.createdAt
        ) {
          return false;
        }
      }
      return true;
    })
    .map((item, index) => ({
      ...item,
      renderKey: buildPRTimelineItemKey(item, index),
    }));
}

export function usePRTimelineEvents(timeline: MaybeRefOrGetter<PRTimelineItem[]>) {
  const processedTimeline = computed(() => normalizePRTimelineItems(toValue(timeline)));

  return {
    processedTimeline,
  };
}

export function parseRepoFullName(repoFullName?: string): { owner: string; repo: string } | null {
  if (!repoFullName) return null;

  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) return null;

  return { owner, repo };
}

export function parseGitHubIssueOrPullUrl(url?: string) {
  if (!url) return null;

  const issueMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
  if (issueMatch) {
    const [, owner, repo, number] = issueMatch;
    if (!owner || !repo || !number) return null;

    return {
      kind: 'issue' as const,
      owner,
      repo,
      number: Number.parseInt(number, 10),
    };
  }

  const pullMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (pullMatch) {
    const [, owner, repo, number] = pullMatch;
    if (!owner || !repo || !number) return null;

    return {
      kind: 'pull-request' as const,
      owner,
      repo,
      number: Number.parseInt(number, 10),
    };
  }

  return null;
}

export function getRequestedReviewerLabel(reviewer?: TimelineRequestedReviewer): string {
  if (!reviewer) return 'reviewer';

  if (reviewer.resourceType === 'Team') {
    return reviewer.slug ? `@${reviewer.slug}` : (reviewer.name ?? 'team');
  }

  if (reviewer.resourceType === 'Organization') {
    return reviewer.login ?? reviewer.name ?? 'organization';
  }

  return reviewer.login ?? reviewer.name ?? 'reviewer';
}

export function getRequestedReviewerUrl(reviewer?: TimelineRequestedReviewer): string | undefined {
  if (!reviewer) return undefined;
  if (reviewer.url) return reviewer.url;
  if (reviewer.login) return `https://github.com/${reviewer.login}`;
  return undefined;
}
