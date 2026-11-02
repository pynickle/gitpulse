import { parseGitHubRepoPath } from '~/utils/parseGitHubRepoPath';

export function getRepoName(url: string) {
  const repoPath = parseGitHubRepoPath(url);
  if (repoPath) {
    return repoPath.fullName;
  }

  const parts = url.split('/');
  return parts[parts.length - 1] || 'Unknown';
}
