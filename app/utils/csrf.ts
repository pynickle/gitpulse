export const CSRF_COOKIE_NAME = 'gitpulse_csrf';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// SSR event.$fetch copies headers with object spread, which drops a Headers instance.
export function withCsrfHeader(
  headers: HeadersInit | undefined,
  token: string
): Record<string, string> {
  const merged = plainHeaders(headers);
  const headerName = CSRF_HEADER_NAME.toLowerCase();

  for (const key of Object.keys(merged)) {
    if (key.toLowerCase() === headerName) delete merged[key];
  }

  merged[CSRF_HEADER_NAME] = token;
  return merged;
}

function plainHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    const plain: Record<string, string> = {};
    headers.forEach((value, key) => {
      plain[key] = value;
    });
    return plain;
  }

  if (Array.isArray(headers)) {
    const plain: Record<string, string> = {};
    for (const [key, value] of headers) {
      plain[key] = value;
    }
    return plain;
  }

  return { ...headers };
}

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
