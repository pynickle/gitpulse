import { isGitHubApiHost, isGitHubWebHost, parseUrl } from './github-url-utils';

export interface GitHubMarkdownTarget {
  owner: string;
  repo: string;
  number: number;
  type: 'issue' | 'pull-request';
}

const WEB_PATH_PATTERN = /^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)(?:\/|$)/;
const API_PATH_PATTERN = /^\/repos\/([^/]+)\/([^/]+)\/(issues|pulls)\/(\d+)(?:\/|$)/;

const getDetailType = (type: string): GitHubMarkdownTarget['type'] | null => {
  if (type === 'issues') return 'issue';
  if (type === 'pull' || type === 'pulls') return 'pull-request';
  return null;
};

export default function parseGitHubMarkdownTarget(
  href?: string | null
): GitHubMarkdownTarget | null {
  if (!href) return null;

  const url = parseUrl(href);
  if (!url) return null;

  const match = isGitHubApiHost(url.hostname)
    ? url.pathname.match(API_PATH_PATTERN)
    : isGitHubWebHost(url.hostname)
      ? url.pathname.match(WEB_PATH_PATTERN)
      : null;
  if (!match) {
    return null;
  }

  const [, owner, repo, rawType, rawNumber] = match;
  const type = getDetailType(rawType ?? '');
  const number = Number.parseInt(rawNumber ?? '', 10);

  if (!owner || !repo || !type || !Number.isSafeInteger(number) || number < 1) {
    return null;
  }

  return {
    owner,
    repo,
    number,
    type,
  };
}
