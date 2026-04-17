interface GitHubMarkdownTarget {
  owner: string;
  repo: string;
  number: number;
  type: 'issue' | 'pull-request';
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com', 'api.github.com']);

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

  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();

    if (!GITHUB_HOSTS.has(host)) {
      return null;
    }

    const match = url.pathname.match(WEB_PATH_PATTERN) ?? url.pathname.match(API_PATH_PATTERN);
    if (!match) {
      return null;
    }

    const [, owner, repo, rawType, rawNumber] = match;
    const type = getDetailType(rawType ?? '');
    const number = Number.parseInt(rawNumber ?? '', 10);

    if (!owner || !repo || !type || !Number.isFinite(number)) {
      return null;
    }

    return {
      owner,
      repo,
      number,
      type,
    };
  } catch {
    return null;
  }
}
