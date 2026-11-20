export interface SubIssueIdentity {
  owner: string;
  repo: string;
  number: number;
}

export interface SubIssueProgress {
  completed: number;
  total: number;
}

/** Open vs. explicit completed closure vs. other closed reasons (e.g. not_planned). */
export type SubIssueDisplayState = 'open' | 'completed' | 'notPlanned' | 'closed';

export interface SubIssueNode {
  owner: string | null;
  repo: string | null;
  number: number | null;
  title: string | null;
  state: SubIssueDisplayState;
  subIssuesSummary: SubIssueProgress | null;
}

export interface SubIssueConnection {
  totalCount: number | null;
  completedCount?: number | null;
  nodes: SubIssueNode[];
}

export interface SubIssueRow {
  owner: string;
  repo: string;
  number: number;
  title: string;
  state: SubIssueDisplayState;
  showRepository: boolean;
  subIssuesSummary: SubIssueProgress | null;
}
