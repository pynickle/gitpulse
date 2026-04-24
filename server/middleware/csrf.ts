import { getCookie, getHeader, getRequestHost } from 'h3';

const CSRF_COOKIE_NAME = 'gitpulse_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_EXEMPT_PATHS = [
  '/api/auth/github',
  '/api/auth/github/callback',
];

function matchesExemptPath(pathname: string): boolean {
  for (const exempt of CSRF_EXEMPT_PATHS) {
    if (pathname === exempt || pathname.startsWith(`${exempt}?`)) {
      return true;
    }
  }
  return false;
}

function extractOriginHost(originOrReferer: string): string | null {
  try {
    const url = new URL(originOrReferer);
    return url.host;
  } catch {
    return null;
  }
}

function timingSafeStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

export default defineEventHandler((event) => {
  const method = (event.method ?? 'GET').toUpperCase();

  if (SAFE_METHODS.has(method)) {
    return;
  }

  const url = event.path ?? event.node.req.url ?? '';

  if (!url.startsWith('/api/')) {
    return;
  }

  const pathname = url.split('?')[0] ?? url;

  if (matchesExemptPath(pathname)) {
    return;
  }

  const headerToken = getHeader(event, CSRF_HEADER_NAME) ?? '';
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME) ?? '';

  if (!headerToken || !cookieToken || !timingSafeStringEqual(headerToken, cookieToken)) {
    console.warn(`[csrf] token mismatch on ${method} ${pathname}`);
    throw createError({
      statusCode: 403,
      statusMessage: 'csrf_mismatch',
    });
  }

  const origin = getHeader(event, 'origin') ?? '';
  const referer = getHeader(event, 'referer') ?? '';
  const originSource = origin || referer;

  if (originSource) {
    const requestHost = getRequestHost(event);
    const originHost = extractOriginHost(originSource);

    if (!originHost || !requestHost || originHost !== requestHost) {
      console.warn(`[csrf] origin mismatch on ${method} ${pathname}`);
      throw createError({
        statusCode: 403,
        statusMessage: 'csrf_mismatch',
      });
    }
  }
});
