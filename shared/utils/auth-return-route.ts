const INTERNAL_ORIGIN = 'https://gitpulse.invalid';

const DISALLOWED_PATH_PREFIXES = ['/api', '/auth'];

export const DEFAULT_AUTH_RETURN_PATH = '/dashboard';

/**
 * Keeps an authentication return target inside the current GitPulse origin.
 * Only a path, query string, and hash are persisted; absolute URLs are rejected.
 */
export function normalizeAuthReturnTo(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const rawValue = value.trim();
  if (
    !rawValue ||
    rawValue.length > 2000 ||
    !rawValue.startsWith('/') ||
    rawValue.startsWith('//') ||
    rawValue.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(rawValue)
  ) {
    return null;
  }

  let url: URL;
  try {
    if (encodeURIComponent(rawValue).length > 3500) return null;
    url = new URL(rawValue, INTERNAL_ORIGIN);
  } catch {
    return null;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (
    url.origin !== INTERNAL_ORIGIN ||
    decodedPath.startsWith('//') ||
    decodedPath.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decodedPath) ||
    DISALLOWED_PATH_PREFIXES.some(
      (prefix) => decodedPath === prefix || decodedPath.startsWith(`${prefix}/`)
    )
  ) {
    return null;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function withAppBase(path: string, baseUrl: string | undefined): string {
  const normalizedBaseUrl = (baseUrl ?? '').trim().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}
