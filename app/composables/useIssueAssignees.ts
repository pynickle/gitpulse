import type {
  IssueAssigneeCandidate,
  IssueAssigneeCandidatesResponse,
  IssueAssigneeMutationResponse,
  IssueAssigneeUser,
} from '#shared/types/assignees';

export type {
  IssueAssigneeCandidate,
  IssueAssigneeCandidatesResponse,
  IssueAssigneeMutationResponse,
  IssueAssigneeUser,
} from '#shared/types/assignees';

export interface IssueAssigneeMutationPayload {
  assignees: string[];
}

export function useIssueAssignees() {
  const apiFetch = useGitPulseApiFetch();

  const fetchAssigneeCandidates = (owner: string, repo: string, issueNumber: number, query = '') =>
    apiFetch<IssueAssigneeCandidatesResponse>(
      `/api/issues/${owner}/${repo}/${issueNumber}/assignees/candidates`,
      {
        method: 'GET',
        query: query ? { q: query } : undefined,
      }
    );

  const addAssignees = (
    owner: string,
    repo: string,
    issueNumber: number,
    payload: IssueAssigneeMutationPayload
  ) =>
    apiFetch<IssueAssigneeMutationResponse>(
      `/api/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
      {
        method: 'POST',
        body: payload,
      }
    );

  const removeAssignees = (
    owner: string,
    repo: string,
    issueNumber: number,
    payload: IssueAssigneeMutationPayload
  ) =>
    apiFetch<IssueAssigneeMutationResponse>(
      `/api/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
      {
        method: 'DELETE',
        body: payload,
      }
    );

  return {
    fetchAssigneeCandidates,
    addAssignees,
    removeAssignees,
  };
}
