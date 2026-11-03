import { appLocales, defaultLocaleCode } from './app-locales';

export interface ResolvedRoute {
  matchedCount: number;
  path: string;
}

function pathname(value: string): string {
  const hash = value.indexOf('#');
  const withoutHash = hash === -1 ? value : value.slice(0, hash);
  const query = withoutHash.indexOf('?');
  const path = query === -1 ? withoutHash : withoutHash.slice(0, query);
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

/** Locale landing pages and the native login page render without a session. */
export function isPublicSurfacePath(value: string): boolean {
  const path = pathname(value);
  if (path === '/') return true;
  if (
    appLocales.some((locale) => locale.code !== defaultLocaleCode && path === `/${locale.code}`)
  ) {
    return true;
  }
  return path === '/native-login' || path.endsWith('/native-login');
}

/**
 * Keeps a sanitized return target only when it resolves to a session surface.
 * Unknown paths and public pages fall back to the dashboard.
 */
export function admitAuthReturnTo(
  returnTo: string | null,
  resolve: (fullPath: string) => ResolvedRoute,
  fallback: string
): string {
  if (!returnTo) return fallback;

  const resolved = resolve(returnTo);
  if (resolved.matchedCount === 0 || isPublicSurfacePath(resolved.path)) return fallback;
  return returnTo;
}
