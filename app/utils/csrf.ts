export const CSRF_COOKIE_NAME = 'gitpulse_csrf';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function normalizeMethod(method: unknown): string {
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
}

export function isSameOriginApiUrl(request: unknown): boolean {
  if (typeof request !== 'string') {
    return false;
  }

  if (request.startsWith('/api/')) {
    return true;
  }

  try {
    const parsed = new URL(request, window.location.origin);

    return (
      parsed.origin === window.location.origin &&
      (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/auth/'))
    );
  } catch {
    return false;
  }
}
