/**
 * Issue detail payload from the GitHub API.
 */

import type { IssueAssigneeUser } from './assignees';
import type { ReactionSummaryItem } from './reactions';

export type GitHubIssueTypeColor =
  | 'gray'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple';

export interface IssueTypeSummary {
  name: string;
  color?: string | null;
}

export interface GitHubIssueType extends IssueTypeSummary {
  id: number;
  node_id: string;
  description: string | null;
  color?: GitHubIssueTypeColor | null;
  created_at?: string;
  updated_at?: string;
  is_enabled?: boolean;
}

export interface IssueDetailLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}

export interface IssueDetailPayload {
  id: number;
  number: number;
  state: string;
  title: string;
  body?: string | null;
  html_url?: string;
  repository_url: string;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  locked?: boolean;

  user?: {
    login: string;
    id?: number | string;
    avatar_url?: string | null;
  } | null;

  assignee?: IssueAssigneeUser | null;
  assignees?: IssueAssigneeUser[];

  labels?: IssueDetailLabel[];
  type?: GitHubIssueType | null;
  reactions?: ReactionSummaryItem[];

  [key: string]: unknown;
}
