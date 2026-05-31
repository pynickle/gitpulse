import { assertCsrfToken } from '../utils/csrf-utils';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_EXEMPT_PATHS = ['/api/auth/github', '/api/auth/github/callback'];

function matchesExemptPath(pathname: string): boolean {
  for (const exempt of CSRF_EXEMPT_PATHS) {
    if (pathname === exempt || pathname.startsWith(`${exempt}?`)) {
      return true;
    }
  }
  return false;
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

  assertCsrfToken(event, pathname);
});
