export interface GitHubRepoPath {
  owner: string;
  repo: string;
  fullName: string;
}

export default function (url?: string | null): GitHubRepoPath | null {
  if (!url) return null;

  const normalizedUrl = url.replace(/^https?:\/\/[^/]+/i, '');
  const segments = normalizedUrl.split('/').filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const repoRootIndex = segments[0] === 'repos' ? 1 : 0;
  const owner = segments[repoRootIndex];
  const repo = segments[repoRootIndex + 1];

  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}
