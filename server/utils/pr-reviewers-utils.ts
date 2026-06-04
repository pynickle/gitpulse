import type { Octokit } from '@octokit/core';

import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import { normalizeRequestBody } from '#server/utils/repo-route-utils';

type GitHubClient = Octokit;

type ReviewerKind = 'user' | 'team';

export type PRReviewerStatus =
  | 'requested'
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed'
  | 'pending'
  | 'unknown';

interface GitHubUserSummary {
  id?: number | string;
  node_id?: string;
  login?: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

interface GitHubTeamSummary {
  id?: number | string;
  node_id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

interface PullReviewResponse {
  id?: number | string;
  node_id?: string;
  state?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  html_url?: string | null;
  user?: GitHubUserSummary | null;
}

interface PullReviewCommentResponse {
  user?: GitHubUserSummary | null;
  created_at?: string | null;
}

interface RequestedReviewersResponse {
  users: GitHubUserSummary[];
  teams: GitHubTeamSummary[];
}

interface ReviewerRequestBody {
  reviewers?: unknown;
  teamReviewers?: unknown;
}

interface PRReviewerSummaryTelemetry {
  requestCount: number;
  pageCount: number;
  lowestRateLimitRemaining?: number;
  lowestRateLimitResource?: string;
}

export interface NormalizedReviewerRequestBody {
  reviewers: string[];
  teamReviewers: string[];
}

export interface PRReviewerSummaryItem {
  key: string;
  kind: ReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  status: PRReviewerStatus;
  rawState?: string;
  latestSubmittedAt?: string | null;
  latestCommentedAt?: string | null;
  latestReviewUrl?: string | null;
  reviewCount: number;
  commentCount: number;
  requested: boolean;
  removable: boolean;
}

export interface PRReviewersSummary {
  items: PRReviewerSummaryItem[];
  requestedUsers: GitHubUserSummary[];
  requestedTeams: GitHubTeamSummary[];
  counts: Record<PRReviewerStatus, number> & {
    total: number;
    users: number;
    teams: number;
  };
  warnings?: PRReviewerSummaryWarning[];
}

export interface PRReviewerCandidate {
  key: string;
  kind: ReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  requested: boolean;
}

export interface PRReviewerCandidatesResponse {
  query: string;
  items: PRReviewerCandidate[];
  users: PRReviewerCandidate[];
  teams: PRReviewerCandidate[];
  warnings: PRReviewerCandidateWarning[];
  canRequestReviewers: boolean;
}

export interface PRReviewerSummaryWarning {
  source: 'reviewer-summary';
  message: string;
}

export interface PRReviewerCandidateWarning {
  source: 'requested-reviewers' | 'collaborators' | 'teams';
  message: string;
}

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getErrorMessage = (error: unknown, fallback: string) =>
  (error as { message?: string })?.message || fallback;

const getErrorStatus = (error: unknown) => {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
};

const isReviewerRequestPermissionError = (error: unknown) => {
  const message = getErrorMessage(error, '').toLowerCase();
  return (
    getErrorStatus(error) === 403 ||
    message.includes('must have push access') ||
    message.includes('push access to view repository collaborators')
  );
};

const stringifyId = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
};

const userKey = (login: string) => `user:${login.toLowerCase()}`;
const teamKey = (slug: string) => `team:${slug.toLowerCase()}`;

const REVIEWER_SUMMARY_SLOW_MS = 2500;
const REVIEWER_SUMMARY_LOW_RATE_LIMIT_REMAINING = 500;

function getHeaderValue(headers: unknown, headerName: string) {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const headerRecord = headers as Record<string, unknown>;
  const directValue =
    headerRecord[headerName] ??
    headerRecord[headerName.toLowerCase()] ??
    headerRecord[headerName.toUpperCase()];

  if (directValue !== undefined) {
    return directValue;
  }

  const matchingKey = Object.keys(headerRecord).find(
    (key) => key.toLowerCase() === headerName.toLowerCase()
  );

  return matchingKey ? headerRecord[matchingKey] : undefined;
}

function stringifyHeaderValue(value: unknown) {
  if (Array.isArray(value)) {
    return stringifyHeaderValue(value[0]);
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }

  return undefined;
}

function trackReviewerSummaryRateLimit(telemetry: PRReviewerSummaryTelemetry, headers: unknown) {
  const remainingHeader = stringifyHeaderValue(getHeaderValue(headers, 'x-ratelimit-remaining'));
  const remaining = remainingHeader ? Number.parseInt(remainingHeader, 10) : NaN;

  if (!Number.isFinite(remaining)) {
    return;
  }

  if (
    telemetry.lowestRateLimitRemaining !== undefined &&
    remaining >= telemetry.lowestRateLimitRemaining
  ) {
    return;
  }

  telemetry.lowestRateLimitRemaining = remaining;
  telemetry.lowestRateLimitResource = stringifyHeaderValue(
    getHeaderValue(headers, 'x-ratelimit-resource')
  );
}

function isPaginatedReviewerSummaryRequest(args: Parameters<GitHubClient['request']>) {
  const parameters = args[1] as Record<string, unknown> | undefined;
  return typeof parameters?.page === 'number';
}

function createReviewerSummaryTelemetryClient(
  octokit: GitHubClient,
  telemetry: PRReviewerSummaryTelemetry
): GitHubClient {
  const trackedRequest = (async (...args: Parameters<GitHubClient['request']>) => {
    telemetry.requestCount += 1;
    if (isPaginatedReviewerSummaryRequest(args)) {
      telemetry.pageCount += 1;
    }

    const response = await octokit.request(...args);
    trackReviewerSummaryRateLimit(telemetry, response.headers);
    return response;
  }) as GitHubClient['request'];

  return {
    request: trackedRequest,
  } as GitHubClient;
}

function warnIfReviewerSummaryTelemetryExceeded(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  startedAt: number;
  telemetry: PRReviewerSummaryTelemetry;
  requestedReviewers: RequestedReviewersResponse;
  reviews: PullReviewResponse[];
  reviewComments: PullReviewCommentResponse[];
}) {
  const durationMs = Date.now() - params.startedAt;
  const slow = durationMs >= REVIEWER_SUMMARY_SLOW_MS;
  const lowRateLimit =
    params.telemetry.lowestRateLimitRemaining !== undefined &&
    params.telemetry.lowestRateLimitRemaining <= REVIEWER_SUMMARY_LOW_RATE_LIMIT_REMAINING;

  if (!slow && !lowRateLimit) {
    return;
  }

  console.warn('[gitpulse] PR reviewer summary telemetry', {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    reasons: [slow ? 'slow' : null, lowRateLimit ? 'low-rate-limit' : null].filter(Boolean),
    durationMs,
    slowThresholdMs: REVIEWER_SUMMARY_SLOW_MS,
    lowRateLimitThreshold: REVIEWER_SUMMARY_LOW_RATE_LIMIT_REMAINING,
    githubRequestCount: params.telemetry.requestCount,
    githubPageCount: params.telemetry.pageCount,
    requestedUserCount: params.requestedReviewers.users.length,
    requestedTeamCount: params.requestedReviewers.teams.length,
    reviewCount: params.reviews.length,
    reviewCommentCount: params.reviewComments.length,
    lowestRateLimitRemaining: params.telemetry.lowestRateLimitRemaining,
    lowestRateLimitResource: params.telemetry.lowestRateLimitResource,
  });
}

function getReviewerSummaryFailureMessage(error: unknown) {
  const message = trimString(getErrorMessage(error, 'Reviewer summary request failed.'));
  const normalized = message.replace(/\s+/g, ' ');

  return normalized.slice(0, 500) || 'Reviewer summary request failed.';
}

function warnReviewerSummaryFailure(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  startedAt: number;
  telemetry: PRReviewerSummaryTelemetry;
  error: unknown;
}) {
  console.warn('[gitpulse] PR reviewer summary telemetry', {
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    reasons: ['failed'],
    durationMs: Date.now() - params.startedAt,
    githubRequestCount: params.telemetry.requestCount,
    githubPageCount: params.telemetry.pageCount,
    lowestRateLimitRemaining: params.telemetry.lowestRateLimitRemaining,
    lowestRateLimitResource: params.telemetry.lowestRateLimitResource,
    errorMessage: getReviewerSummaryFailureMessage(params.error),
  });
}

function normalizeReviewState(state: unknown): PRReviewerStatus {
  if (typeof state !== 'string') {
    return 'unknown';
  }

  switch (state.toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'COMMENTED':
    case 'COMMENT':
      return 'commented';
    case 'DISMISSED':
      return 'dismissed';
    case 'PENDING':
      return 'pending';
    default:
      return 'unknown';
  }
}

function getReviewTimestamp(review: PullReviewResponse) {
  return review.submitted_at ?? review.created_at ?? null;
}

function isAfter(first?: string | null, second?: string | null) {
  if (!first) {
    return false;
  }

  if (!second) {
    return true;
  }

  return (Date.parse(first) || 0) >= (Date.parse(second) || 0);
}

function ensureUserEntry(
  entries: Map<string, PRReviewerSummaryItem>,
  user: GitHubUserSummary,
  fallbackLogin?: string
) {
  const login = trimString(user.login) || fallbackLogin;

  if (!login) {
    return null;
  }

  const key = userKey(login);
  const existing = entries.get(key);

  if (existing) {
    existing.id ??= stringifyId(user.id);
    existing.nodeId ??= user.node_id;
    existing.avatarUrl ??= user.avatar_url;
    existing.url ??= user.html_url ?? user.url;
    return existing;
  }

  const entry: PRReviewerSummaryItem = {
    key,
    kind: 'user',
    id: stringifyId(user.id),
    nodeId: user.node_id,
    login,
    name: login,
    avatarUrl: user.avatar_url,
    url: user.html_url ?? user.url,
    status: 'unknown',
    reviewCount: 0,
    commentCount: 0,
    requested: false,
    removable: false,
  };
  entries.set(key, entry);
  return entry;
}

function ensureTeamEntry(entries: Map<string, PRReviewerSummaryItem>, team: GitHubTeamSummary) {
  const slug = trimString(team.slug);

  if (!slug) {
    return null;
  }

  const key = teamKey(slug);
  const existing = entries.get(key);

  if (existing) {
    existing.id ??= stringifyId(team.id);
    existing.nodeId ??= team.node_id;
    existing.url ??= team.html_url ?? team.url;
    return existing;
  }

  const name = trimString(team.name) || slug;
  const entry: PRReviewerSummaryItem = {
    key,
    kind: 'team',
    id: stringifyId(team.id),
    nodeId: team.node_id,
    slug,
    name,
    url: team.html_url ?? team.url,
    status: 'requested',
    reviewCount: 0,
    commentCount: 0,
    requested: true,
    removable: true,
  };
  entries.set(key, entry);
  return entry;
}

function sortReviewerItems(items: PRReviewerSummaryItem[]) {
  const statusRank: Record<PRReviewerStatus, number> = {
    changes_requested: 0,
    approved: 1,
    commented: 2,
    requested: 3,
    pending: 4,
    dismissed: 5,
    unknown: 6,
  };

  return items.sort((first, second) => {
    const rankDelta = statusRank[first.status] - statusRank[second.status];
    if (rankDelta !== 0) return rankDelta;
    if (first.kind !== second.kind) return first.kind === 'user' ? -1 : 1;
    return first.name.localeCompare(second.name);
  });
}

function createEmptyReviewerCounts(): PRReviewersSummary['counts'] {
  return {
    requested: 0,
    approved: 0,
    changes_requested: 0,
    commented: 0,
    dismissed: 0,
    pending: 0,
    unknown: 0,
    total: 0,
    users: 0,
    teams: 0,
  };
}

function buildCounts(items: PRReviewerSummaryItem[]): PRReviewersSummary['counts'] {
  const counts: PRReviewersSummary['counts'] = {
    ...createEmptyReviewerCounts(),
    total: items.length,
  };

  for (const item of items) {
    counts[item.status] += 1;
    if (item.kind === 'user') counts.users += 1;
    else counts.teams += 1;
  }

  return counts;
}

export function createEmptyPRReviewerSummary(
  warnings: PRReviewerSummaryWarning[] = []
): PRReviewersSummary {
  return {
    items: [],
    requestedUsers: [],
    requestedTeams: [],
    counts: createEmptyReviewerCounts(),
    warnings,
  };
}

export function normalizeReviewerRequestBody(body: unknown): NormalizedReviewerRequestBody {
  const requestBody = normalizeRequestBody<ReviewerRequestBody>(body) ?? {};

  const normalizeStringArray = (value: unknown, fieldName: string) => {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw createError({
        statusCode: 400,
        statusMessage: `${fieldName} must be an array`,
      });
    }

    const normalized: string[] = [];
    const seen = new Set<string>();

    value.forEach((entry, index) => {
      if (typeof entry !== 'string') {
        throw createError({
          statusCode: 400,
          statusMessage: `${fieldName}[${index}] must be a string`,
        });
      }

      const trimmed = entry.trim();
      if (!trimmed) {
        throw createError({
          statusCode: 400,
          statusMessage: `${fieldName}[${index}] must not be empty`,
        });
      }

      const dedupeKey = trimmed.toLowerCase();
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        normalized.push(trimmed);
      }
    });

    return normalized;
  };

  const reviewers = normalizeStringArray(requestBody.reviewers, 'reviewers');
  const teamReviewers = normalizeStringArray(requestBody.teamReviewers, 'teamReviewers');

  if (!reviewers.length && !teamReviewers.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one reviewer or team reviewer is required',
    });
  }

  return { reviewers, teamReviewers };
}

export async function fetchRequestedReviewers(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<RequestedReviewersResponse> {
  const { data } = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers',
    {
      owner,
      repo,
      pull_number: pullNumber,
    }
  );

  const payload = data as Partial<RequestedReviewersResponse>;
  return {
    users: Array.isArray(payload.users) ? payload.users : [],
    teams: Array.isArray(payload.teams) ? payload.teams : [],
  };
}

export async function fetchPRReviewerSummary(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRReviewersSummary> {
  const startedAt = Date.now();
  const telemetry: PRReviewerSummaryTelemetry = {
    requestCount: 0,
    pageCount: 0,
  };
  const telemetryOctokit = createReviewerSummaryTelemetryClient(octokit, telemetry);

  let requestedReviewers: RequestedReviewersResponse;
  let reviews: PullReviewResponse[];
  let reviewComments: PullReviewCommentResponse[];

  try {
    [requestedReviewers, reviews, reviewComments] = await Promise.all([
      fetchRequestedReviewers(telemetryOctokit, owner, repo, pullNumber),
      fetchPaginatedArray<PullReviewResponse>(
        telemetryOctokit,
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        {
          owner,
          repo,
          pull_number: pullNumber,
        }
      ),
      fetchPaginatedArray<PullReviewCommentResponse>(
        telemetryOctokit,
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
        {
          owner,
          repo,
          pull_number: pullNumber,
        }
      ),
    ]);
  } catch (error: unknown) {
    warnReviewerSummaryFailure({
      owner,
      repo,
      pullNumber,
      startedAt,
      telemetry,
      error,
    });
    throw error;
  }

  const entries = new Map<string, PRReviewerSummaryItem>();

  for (const user of requestedReviewers.users) {
    const entry = ensureUserEntry(entries, user);
    if (!entry) continue;

    entry.requested = true;
    entry.removable = true;
    if (entry.status === 'unknown') {
      entry.status = 'requested';
    }
  }

  for (const team of requestedReviewers.teams) {
    ensureTeamEntry(entries, team);
  }

  for (const review of reviews) {
    if (!review.user) {
      continue;
    }

    const entry = ensureUserEntry(entries, review.user);
    if (!entry) continue;

    entry.reviewCount += 1;

    const latestSubmittedAt = getReviewTimestamp(review);
    if (isAfter(latestSubmittedAt, entry.latestSubmittedAt) || !entry.rawState) {
      entry.status = normalizeReviewState(review.state);
      entry.rawState = typeof review.state === 'string' ? review.state : undefined;
      entry.latestSubmittedAt = latestSubmittedAt;
      entry.latestReviewUrl = review.html_url;
    }
  }

  for (const comment of reviewComments) {
    if (!comment.user) {
      continue;
    }

    const entry = ensureUserEntry(entries, comment.user);
    if (!entry) continue;

    entry.commentCount += 1;
    if (isAfter(comment.created_at, entry.latestCommentedAt)) {
      entry.latestCommentedAt = comment.created_at ?? null;
    }

    if (entry.status === 'unknown' || entry.status === 'requested') {
      entry.status = 'commented';
    }
  }

  for (const entry of entries.values()) {
    if (entry.requested) {
      entry.status = 'requested';
    }
  }

  const items = sortReviewerItems([...entries.values()]);
  const summary = {
    items,
    requestedUsers: requestedReviewers.users,
    requestedTeams: requestedReviewers.teams,
    counts: buildCounts(items),
  };

  warnIfReviewerSummaryTelemetryExceeded({
    owner,
    repo,
    pullNumber,
    startedAt,
    telemetry,
    requestedReviewers,
    reviews,
    reviewComments,
  });

  return summary;
}

function mapUserCandidate(
  user: GitHubUserSummary,
  requestedKeys: Set<string>
): PRReviewerCandidate | null {
  const login = trimString(user.login);
  if (!login) return null;

  const key = userKey(login);
  return {
    key,
    kind: 'user',
    id: stringifyId(user.id),
    nodeId: user.node_id,
    login,
    name: login,
    avatarUrl: user.avatar_url,
    url: user.html_url ?? user.url,
    requested: requestedKeys.has(key),
  };
}

function mapTeamCandidate(
  team: GitHubTeamSummary,
  requestedKeys: Set<string>
): PRReviewerCandidate | null {
  const slug = trimString(team.slug);
  if (!slug) return null;

  const key = teamKey(slug);
  return {
    key,
    kind: 'team',
    id: stringifyId(team.id),
    nodeId: team.node_id,
    slug,
    name: trimString(team.name) || slug,
    avatarUrl: team.avatar_url,
    url: team.html_url ?? team.url,
    requested: requestedKeys.has(key),
  };
}

function matchesCandidate(candidate: PRReviewerCandidate, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [candidate.name, candidate.login, candidate.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

interface OrganizationTeamsGraphqlResponse {
  organization?: {
    teams?: {
      nodes?: Array<{
        id?: string;
        databaseId?: number | null;
        combinedSlug?: string;
        name?: string;
        description?: string | null;
        avatarUrl?: string | null;
        repositories?: {
          nodes?: Array<{
            nameWithOwner?: string;
          } | null> | null;
        } | null;
      } | null> | null;
    } | null;
  } | null;
}

const getTeamSlugFromCombinedSlug = (combinedSlug: unknown) => {
  const value = trimString(combinedSlug);
  if (!value) return '';
  const [, slug = value] = value.split('/');
  return slug.trim();
};

async function fetchRepositoryTeams(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<GitHubTeamSummary[]> {
  const response = await octokit.graphql<OrganizationTeamsGraphqlResponse>(
    `query GitPulseRepositoryReviewTeams($owner: String!) {
      organization(login: $owner) {
        teams(first: 100) {
          nodes {
            id
            databaseId
            combinedSlug
            name
            description
            avatarUrl(size: 40)
            repositories(first: 100) {
              nodes {
                nameWithOwner
              }
            }
          }
        }
      }
    }`,
    { owner }
  );

  const repoNameWithOwner = `${owner}/${repo}`.toLowerCase();
  const teams = response.organization?.teams?.nodes ?? [];

  return teams.flatMap((team) => {
    if (!team) return [];

    const hasRepo = (team.repositories?.nodes ?? []).some(
      (repository) => repository?.nameWithOwner?.toLowerCase() === repoNameWithOwner
    );
    if (!hasRepo) return [];

    const slug = getTeamSlugFromCombinedSlug(team.combinedSlug);
    if (!slug) return [];

    const teamUrl = `https://github.com/orgs/${owner}/teams/${slug}`;
    return [
      {
        id: team.databaseId ?? undefined,
        node_id: team.id,
        slug,
        name: team.name,
        description: team.description,
        avatar_url: team.avatarUrl,
        html_url: teamUrl,
        url: teamUrl,
      },
    ];
  });
}

export async function fetchReviewerCandidates(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  query = ''
) {
  let requestedReviewers: RequestedReviewersResponse = { users: [], teams: [] };
  let collaborators: GitHubUserSummary[] = [];
  let teams: GitHubTeamSummary[] = [];
  let canRequestReviewers = true;
  const warnings: PRReviewerCandidateWarning[] = [];

  try {
    requestedReviewers = await fetchRequestedReviewers(octokit, owner, repo, pullNumber);
  } catch (error: unknown) {
    warnings.push({
      source: 'requested-reviewers',
      message: getErrorMessage(error, 'Requested reviewers are unavailable.'),
    });
  }

  try {
    collaborators = await fetchPaginatedArray<GitHubUserSummary>(
      octokit,
      'GET /repos/{owner}/{repo}/collaborators',
      {
        owner,
        repo,
      }
    );
  } catch (error: unknown) {
    if (isReviewerRequestPermissionError(error)) {
      canRequestReviewers = false;
    }
    warnings.push({
      source: 'collaborators',
      message: getErrorMessage(error, 'Repository collaborators are unavailable.'),
    });
  }

  try {
    teams = await fetchRepositoryTeams(octokit, owner, repo);
  } catch (error: unknown) {
    warnings.push({
      source: 'teams',
      message: getErrorMessage(error, 'Repository teams are unavailable.'),
    });
  }

  const requestedKeys = new Set([
    ...requestedReviewers.users
      .map((user) => trimString(user.login))
      .filter(Boolean)
      .map(userKey),
    ...requestedReviewers.teams
      .map((team) => trimString(team.slug))
      .filter(Boolean)
      .map(teamKey),
  ]);

  if (!canRequestReviewers) {
    return {
      query,
      items: [],
      users: [],
      teams: [],
      warnings,
      canRequestReviewers,
    };
  }

  const userCandidates = collaborators
    .map((user) => mapUserCandidate(user, requestedKeys))
    .filter((candidate): candidate is PRReviewerCandidate => Boolean(candidate))
    .filter((candidate) => matchesCandidate(candidate, query));

  const teamCandidates = teams
    .map((team) => mapTeamCandidate(team, requestedKeys))
    .filter((candidate): candidate is PRReviewerCandidate => Boolean(candidate))
    .filter((candidate) => matchesCandidate(candidate, query));

  const items = [...userCandidates, ...teamCandidates].sort((first, second) => {
    if (first.kind !== second.kind) return first.kind === 'user' ? -1 : 1;
    return first.name.localeCompare(second.name);
  });

  return {
    query,
    items,
    users: userCandidates,
    teams: teamCandidates,
    warnings,
    canRequestReviewers,
  };
}
