export const CSRF_COOKIE_NAME = 'gitpulse_csrf';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function normalizeMethod(method: unknown): string {
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
}

function getLocationOrigin(): string | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const location = (globalThis as { location?: { origin?: string } }).location;
  return typeof location?.origin === 'string' ? location.origin : null;
}

export function isSameOriginApiUrl(request: unknown): boolean {
  if (typeof request !== 'string') {
    return false;
  }

  // Relative same-origin API and auth routes (auth lives outside /api but mutates session).
  if (request.startsWith('/api/') || request.startsWith('/auth/')) {
    return true;
  }

  const origin = getLocationOrigin();
  if (!origin) {
    return false;
  }

  try {
    const parsed = new URL(request, origin);

    return (
      parsed.origin === origin &&
      (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/auth/'))
    );
  } catch {
    return false;
  }
}
