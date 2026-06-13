import {
  hasAbsoluteUrlProtocol,
  isGitHubApiHost,
  isGitHubWebHost,
  parseUrl,
} from './githubUrlUtils';

export interface GitHubRepoPath {
  owner: string;
  repo: string;
  fullName: string;
}

const WEB_REPO_PATH_PATTERN = /^\/([^/]+)\/([^/]+)$/;
const API_REPO_PATH_PATTERN = /^\/repos\/([^/]+)\/([^/]+)$/;
const RELATIVE_WEB_REPO_PATH_PATTERN = /^\/?([^/]+)\/([^/]+)$/;
const RELATIVE_API_REPO_PATH_PATTERN = /^\/?repos\/([^/]+)\/([^/]+)$/;

export default function (url?: string | null): GitHubRepoPath | null {
  if (!url) return null;

  const match = getRepoPathMatch(url);
  if (!match) return null;

  const [, owner, repo] = match;

  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

function getRepoPathMatch(value: string): RegExpMatchArray | null {
  if (!hasAbsoluteUrlProtocol(value)) {
    return (
      value.match(RELATIVE_API_REPO_PATH_PATTERN) ?? value.match(RELATIVE_WEB_REPO_PATH_PATTERN)
    );
  }

  const parsedUrl = parseUrl(value);
  if (!parsedUrl) {
    return null;
  }

  if (isGitHubApiHost(parsedUrl.hostname)) {
    return parsedUrl.pathname.match(API_REPO_PATH_PATTERN);
  }

  if (isGitHubWebHost(parsedUrl.hostname)) {
    return parsedUrl.pathname.match(WEB_REPO_PATH_PATTERN);
  }

  return null;
}
