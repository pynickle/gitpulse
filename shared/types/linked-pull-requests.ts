/** Routing identity for one Linked Pull Request. */
export interface LinkedPullRequestIdentity {
  owner: string;
  repo: string;
  number: number;
}

/**
 * List-stage Linked Pull Request Count plus at most one routing identity.
 * Identity is present only when Count is 1 and owner, repository, and number
 * are all present.
 */
export interface LinkedPullRequestListSummary {
  count: number;
  identity: LinkedPullRequestIdentity | null;
}

export type LinkedPullRequestClickIntent =
  | { kind: 'hide' }
  | { kind: 'open'; identity: LinkedPullRequestIdentity }
  | { kind: 'pick' };

/** Open includes drafts as a display refinement; sort treats draft with open. */
export type LinkedPullRequestDisplayState = 'open' | 'draft' | 'merged' | 'closed';

export interface LinkedPullRequestNode {
  owner: string | null;
  repo: string | null;
  number: number | null;
  title?: string | null;
  authorLogin?: string | null;
  updatedAt?: string | null;
  state?: LinkedPullRequestDisplayState | null;
}

export interface LinkedPullRequestConnection {
  totalCount: number | null;
  nodes: LinkedPullRequestNode[];
}

export interface LinkedPullRequestPickerRow {
  owner: string;
  repo: string;
  number: number;
  title: string;
  authorLogin: string;
  updatedAt: string | null;
  state: LinkedPullRequestDisplayState;
  showRepository: boolean;
}

export type LinkedPullRequestPickerGroupKind = 'same-repository' | 'other-repositories';

export interface LinkedPullRequestPickerGroup {
  kind: LinkedPullRequestPickerGroupKind;
  showHeader: boolean;
  rows: LinkedPullRequestPickerRow[];
}

export interface LinkedPullRequestPickerModel {
  groups: LinkedPullRequestPickerGroup[];
  remainder: number;
}

export interface LinkedPullRequestCountClickPayload {
  summary: LinkedPullRequestListSummary;
  issue: LinkedPullRequestIdentity | null;
}
