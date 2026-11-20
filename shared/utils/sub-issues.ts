import type {
  SubIssueIdentity,
  SubIssueNode,
  SubIssueProgress,
  SubIssueRow,
} from '../types/sub-issues';

const toNonEmptyString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const toIssueNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }

  return value;
};

const toNonNegativeInt = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return value;
};

export function readSubIssueProgress(value: unknown): SubIssueProgress | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<SubIssueProgress>;
  const total = toNonNegativeInt(candidate.total);
  const completed = toNonNegativeInt(candidate.completed);
  if (total === null || completed === null || total < 1) {
    return null;
  }

  return {
    completed: Math.min(completed, total),
    total,
  };
}

export function toSubIssueIdentity(value: unknown): SubIssueIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<SubIssueIdentity>;
  const owner = toNonEmptyString(candidate.owner);
  const repo = toNonEmptyString(candidate.repo);
  const number = toIssueNumber(candidate.number);

  if (!owner || !repo || number === null) {
    return null;
  }

  return { owner, repo, number };
}

const toRow = (
  node: SubIssueNode,
  identity: SubIssueIdentity,
  showRepository: boolean
): SubIssueRow => {
  return {
    owner: identity.owner,
    repo: identity.repo,
    number: identity.number,
    title: toNonEmptyString(node.title) ?? '',
    state: node.state,
    showRepository,
    subIssuesSummary: readSubIssueProgress(node.subIssuesSummary),
  };
};

export const toSubIssueRows = (
  nodes: SubIssueNode[],
  issue: Pick<SubIssueIdentity, 'owner' | 'repo'>
): SubIssueRow[] => {
  const rows: SubIssueRow[] = [];

  for (const node of nodes) {
    const identity = toSubIssueIdentity({
      owner: node.owner,
      repo: node.repo,
      number: node.number,
    });
    if (!identity) continue;

    const isSameRepository =
      identity.owner.toLowerCase() === issue.owner.toLowerCase() &&
      identity.repo.toLowerCase() === issue.repo.toLowerCase();
    rows.push(toRow(node, identity, !isSameRepository));
  }

  return rows;
};
