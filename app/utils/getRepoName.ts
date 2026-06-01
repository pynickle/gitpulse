import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

export default function (url: string) {
  const repoPath = parseGitHubRepoPath(url);
  if (repoPath) {
    return repoPath.fullName;
  }

  const parts = url.split('/');
  return parts[parts.length - 1] || 'Unknown';
}
