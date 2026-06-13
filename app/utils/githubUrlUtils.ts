export const GITHUB_API_HOST = 'api.github.com';
export const GITHUB_RAW_HOST = 'raw.githubusercontent.com';

const GITHUB_WEB_HOSTS = new Set(['github.com', 'www.github.com']);
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

export function hasAbsoluteUrlProtocol(value: string) {
  return ABSOLUTE_URL_PATTERN.test(value);
}

export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isGitHubApiHost(hostname: string) {
  return hostname.toLowerCase() === GITHUB_API_HOST;
}

export function isGitHubRawHost(hostname: string) {
  return hostname.toLowerCase() === GITHUB_RAW_HOST;
}

export function isGitHubWebHost(hostname: string) {
  return GITHUB_WEB_HOSTS.has(hostname.toLowerCase());
}
