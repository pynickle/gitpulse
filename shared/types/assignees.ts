export interface IssueAssigneeUser {
  id?: number | string;
  node_id?: string;
  login: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface IssueAssigneeCandidate extends IssueAssigneeUser {
  assigned: boolean;
}

export interface IssueAssigneeCandidates {
  query: string;
  items: IssueAssigneeCandidate[];
}

export interface IssueAssigneeCandidatesResponse extends IssueAssigneeCandidates {
  assignees: IssueAssigneeUser[];
}

export type IssueAssigneeMutationResponse = {
  assignee?: IssueAssigneeUser | null;
  assignees?: IssueAssigneeUser[];
  [key: string]: unknown;
};
