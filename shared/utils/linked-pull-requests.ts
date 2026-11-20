import type {
  LinkedPullRequestClickIntent,
  LinkedPullRequestConnection,
  LinkedPullRequestDisplayState,
  LinkedPullRequestIdentity,
  LinkedPullRequestListModel,
  LinkedPullRequestListSummary,
  LinkedPullRequestNode,
  LinkedPullRequestPickerModel,
  LinkedPullRequestRow,
  LinkedPullRequestRowGroup,
  LinkedPullRequestRowGroupKind,
} from '../types/linked-pull-requests';

export const LINKED_PULL_REQUEST_PICKER_PAGE_SIZE = 20;

/** Rows the Issue Detail Overlay shows before the reader asks for the rest. */
export const LINKED_PULL_REQUEST_LIST_VISIBLE_LIMIT = 5;

const DISPLAY_STATE_SORT_RANK: Record<LinkedPullRequestDisplayState, number> = {
  open: 0,
  draft: 0,
  merged: 1,
  closed: 2,
};

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const toIssueNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }

  return value;
};

const toCount = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return value;
};

export function toLinkedPullRequestIdentity(value: unknown): LinkedPullRequestIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<LinkedPullRequestIdentity>;
  const owner = toNonEmptyString(candidate.owner);
  const repo = toNonEmptyString(candidate.repo);
  const number = toIssueNumber(candidate.number);

  if (!owner || !repo || number === null) {
    return null;
  }

  return { owner, repo, number };
}

const toNodeIdentity = (node: LinkedPullRequestNode): LinkedPullRequestIdentity | null => {
  return toLinkedPullRequestIdentity({
    owner: node.owner,
    repo: node.repo,
    number: node.number,
  });
};

const isSameRepository = (
  identity: LinkedPullRequestIdentity,
  issue: LinkedPullRequestIdentity
) => {
  return (
    identity.owner.toLowerCase() === issue.owner.toLowerCase() &&
    identity.repo.toLowerCase() === issue.repo.toLowerCase()
  );
};

export function readLinkedPullRequestListSummary(
  countValue: unknown,
  identityValue: unknown
): LinkedPullRequestListSummary | null {
  const count = toCount(countValue);
  if (count === null) {
    return null;
  }

  return {
    count,
    identity: count === 1 ? toLinkedPullRequestIdentity(identityValue) : null,
  };
}

export function toLinkedPullRequestListSummary(
  connection: LinkedPullRequestConnection,
  _issue: Pick<LinkedPullRequestIdentity, 'owner' | 'repo'>
): LinkedPullRequestListSummary | null {
  const firstNode = connection.nodes[0];
  return readLinkedPullRequestListSummary(
    connection.totalCount,
    firstNode ? { owner: firstNode.owner, repo: firstNode.repo, number: firstNode.number } : null
  );
}

export function toLinkedPullRequestClickIntent(
  summary: LinkedPullRequestListSummary | null | undefined,
  previewSingleLinkedPullRequest: boolean
): LinkedPullRequestClickIntent {
  if (!summary || summary.count < 1) {
    return { kind: 'hide' };
  }

  if (summary.count === 1 && summary.identity && !previewSingleLinkedPullRequest) {
    return { kind: 'open', identity: summary.identity };
  }

  return { kind: 'pick' };
}

const toUpdatedAtTime = (value: string | null): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
};

const compareRows = (left: LinkedPullRequestRow, right: LinkedPullRequestRow) => {
  const rankDelta = DISPLAY_STATE_SORT_RANK[left.state] - DISPLAY_STATE_SORT_RANK[right.state];
  if (rankDelta !== 0) return rankDelta;

  return toUpdatedAtTime(right.updatedAt) - toUpdatedAtTime(left.updatedAt);
};

const toRow = (
  node: LinkedPullRequestNode,
  identity: LinkedPullRequestIdentity,
  showRepository: boolean
): LinkedPullRequestRow => {
  const state: LinkedPullRequestDisplayState =
    node.state === 'draft' || node.state === 'merged' || node.state === 'closed'
      ? node.state
      : 'open';

  return {
    owner: identity.owner,
    repo: identity.repo,
    number: identity.number,
    title: toNonEmptyString(node.title) ?? '',
    authorLogin: toNonEmptyString(node.authorLogin) ?? '',
    updatedAt: toNonEmptyString(node.updatedAt),
    state,
    showRepository,
  };
};

interface LinkedPullRequestRowsByRepository {
  sameRepositoryRows: LinkedPullRequestRow[];
  otherRepositoryRows: LinkedPullRequestRow[];
}

const collectRows = (
  nodes: LinkedPullRequestNode[],
  issue: Pick<LinkedPullRequestIdentity, 'owner' | 'repo'>
): LinkedPullRequestRowsByRepository => {
  const issueIdentity: LinkedPullRequestIdentity = {
    owner: issue.owner,
    repo: issue.repo,
    number: 1,
  };

  const sameRepositoryRows: LinkedPullRequestRow[] = [];
  const otherRepositoryRows: LinkedPullRequestRow[] = [];

  for (const node of nodes) {
    const identity = toNodeIdentity(node);
    if (!identity) continue;

    const showRepository = !isSameRepository(identity, issueIdentity);
    const row = toRow(node, identity, showRepository);
    if (showRepository) {
      otherRepositoryRows.push(row);
    } else {
      sameRepositoryRows.push(row);
    }
  }

  sameRepositoryRows.sort(compareRows);
  otherRepositoryRows.sort(compareRows);

  return { sameRepositoryRows, otherRepositoryRows };
};

const toGroups = (
  sameRepositoryRows: LinkedPullRequestRow[],
  otherRepositoryRows: LinkedPullRequestRow[]
): LinkedPullRequestRowGroup[] => {
  const showHeaders = sameRepositoryRows.length > 0 && otherRepositoryRows.length > 0;
  const groups: LinkedPullRequestRowGroup[] = [];
  const kinds: Array<[LinkedPullRequestRowGroupKind, LinkedPullRequestRow[]]> = [
    ['same-repository', sameRepositoryRows],
    ['other-repositories', otherRepositoryRows],
  ];

  for (const [kind, rows] of kinds) {
    if (rows.length > 0) {
      groups.push({ kind, showHeader: showHeaders, rows });
    }
  }

  return groups;
};

export function toLinkedPullRequestPickerModel(
  connection: LinkedPullRequestConnection,
  issue: Pick<LinkedPullRequestIdentity, 'owner' | 'repo'>
): LinkedPullRequestPickerModel {
  const count = toCount(connection.totalCount) ?? 0;
  const remainder = Math.max(0, count - LINKED_PULL_REQUEST_PICKER_PAGE_SIZE);
  const pageNodes = connection.nodes.slice(0, LINKED_PULL_REQUEST_PICKER_PAGE_SIZE);
  const { sameRepositoryRows, otherRepositoryRows } = collectRows(pageNodes, issue);

  return { groups: toGroups(sameRepositoryRows, otherRepositoryRows), remainder };
}

/**
 * Rows the Issue Detail Overlay renders: the first five in the order the Picker
 * shows them, or every loaded row once the reader asks for the rest. Hidden
 * Count also covers rows the connection has not loaded yet.
 */
export function toLinkedPullRequestListModel(
  connection: LinkedPullRequestConnection,
  issue: Pick<LinkedPullRequestIdentity, 'owner' | 'repo'>,
  expanded: boolean
): LinkedPullRequestListModel {
  const { sameRepositoryRows, otherRepositoryRows } = collectRows(connection.nodes, issue);
  const totalCount =
    toCount(connection.totalCount) ?? sameRepositoryRows.length + otherRepositoryRows.length;

  const visibleSameRepositoryRows = expanded
    ? sameRepositoryRows
    : sameRepositoryRows.slice(0, LINKED_PULL_REQUEST_LIST_VISIBLE_LIMIT);
  const remainingRowBudget = expanded
    ? otherRepositoryRows.length
    : Math.max(0, LINKED_PULL_REQUEST_LIST_VISIBLE_LIMIT - visibleSameRepositoryRows.length);
  const visibleOtherRepositoryRows = otherRepositoryRows.slice(0, remainingRowBudget);
  const visibleRowCount = visibleSameRepositoryRows.length + visibleOtherRepositoryRows.length;

  return {
    groups: toGroups(visibleSameRepositoryRows, visibleOtherRepositoryRows),
    hiddenCount: Math.max(0, totalCount - visibleRowCount),
  };
}
