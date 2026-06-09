export const DEFAULT_GITPULSE_BASE_URL = 'https://gitpulse.euphony.ink';

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const PROTOCOL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

const ensureProtocol = (value: string) => {
  return PROTOCOL_PATTERN.test(value) ? value : `https://${value}`;
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const isLoopbackHostname = (hostname: string) => {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(normalizedHostname)
  );
};

export function normalizeGitPulseBaseUrl(value: string | null | undefined): string {
  const rawValue = value?.trim() || DEFAULT_GITPULSE_BASE_URL;
  const url = new URL(ensureProtocol(rawValue));

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new Error('GitPulse URL must use HTTP or HTTPS.');
  }

  if (url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) {
    throw new Error('GitPulse URL must use HTTPS unless it points to localhost.');
  }

  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  url.pathname = trimTrailingSlashes(url.pathname) || '/';

  return url.toString();
}

export function isGithubWebUrl(value: string | null | undefined): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && GITHUB_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function buildGitPulseUrl(
  baseUrl: string | null | undefined,
  githubUrl?: string | null
): string {
  const target = new URL(normalizeGitPulseBaseUrl(baseUrl));
  const normalizedBasePath = trimTrailingSlashes(target.pathname);

  if (!normalizedBasePath || normalizedBasePath === '/') {
    target.pathname = '/dashboard';
  } else if (!normalizedBasePath.endsWith('/dashboard')) {
    target.pathname = `${normalizedBasePath}/dashboard`;
  } else {
    target.pathname = normalizedBasePath;
  }

  target.search = '';
  target.hash = '';

  if (isGithubWebUrl(githubUrl)) {
    target.searchParams.set('url', githubUrl);
  }

  return target.toString();
}
