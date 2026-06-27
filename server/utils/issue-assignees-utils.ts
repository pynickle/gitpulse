import type { Octokit } from '@octokit/core';

import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';
import type { IssueAssigneeCandidate, IssueAssigneeCandidates } from '#shared/types/assignees';

type GitHubClient = Octokit;

interface GitHubUserSummary {
  id?: number | string;
  node_id?: string;
  login?: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const matchesCandidate = (candidate: IssueAssigneeCandidate, query: string) => {
  if (!query) return true;
  return candidate.login.toLowerCase().includes(query.toLowerCase());
};

const mapAssigneeCandidate = (
  user: GitHubUserSummary,
  assignedLogins: Set<string>
): IssueAssigneeCandidate | null => {
  const login = trimString(user.login);
  if (!login) return null;

  return {
    id: user.id,
    node_id: user.node_id,
    login,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    url: user.url,
    assigned: assignedLogins.has(login.toLowerCase()),
  };
};

export async function fetchIssueAssigneeCandidates(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  assignedAssignees: GitHubUserSummary[],
  query = ''
): Promise<IssueAssigneeCandidates> {
  const assignableUsers = await fetchPaginatedArray<GitHubUserSummary>(
    octokit,
    'GET /repos/{owner}/{repo}/assignees',
    {
      owner,
      repo,
    }
  );

  const assignedLogins = new Set(
    assignedAssignees.map((assignee) => trimString(assignee.login).toLowerCase()).filter(Boolean)
  );

  const items = assignableUsers
    .map((user) => mapAssigneeCandidate(user, assignedLogins))
    .filter((candidate): candidate is IssueAssigneeCandidate => Boolean(candidate))
    .filter((candidate) => matchesCandidate(candidate, query))
    .sort((first, second) => first.login.localeCompare(second.login));

  return {
    query,
    items,
  };
}
