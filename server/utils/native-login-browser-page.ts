import { getCookie, setHeader, type H3Event } from 'h3';

import type { NativeLoginBrowserPage } from '#shared/types/native-login-browser';
import { withAppBase } from '#shared/utils/auth-return-route';

import { readNativeLoginBrowser } from './native-login-handoff';

export async function loadNativeLoginBrowserPage(
  event: H3Event,
  query: unknown
): Promise<NativeLoginBrowserPage> {
  const browser = await readNativeLoginBrowser(event, query);
  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'Content-Security-Policy', "frame-ancestors 'none'");

  const session = await getUserSession(event);
  const user = session.user;
  const signedIn = Boolean(
    session.auth_provider === 'github' && user && session.secure?.access_token
  );
  const base = useRuntimeConfig(event).app.baseURL;
  const returnTo = `/native-login?${new URLSearchParams({
    id: browser.id,
    browserToken: browser.browserToken,
  })}`;

  return {
    id: browser.id,
    browserToken: browser.browserToken,
    status: browser.status,
    confirmationCode: browser.confirmationCode,
    signedIn,
    login: signedIn && user ? user.login : '',
    name: signedIn && user ? user.name : '',
    avatarUrl: signedIn && user ? user.avatar_url : '',
    signInUrl: `${withAppBase('/auth/github', base)}?${new URLSearchParams({ returnTo })}`,
    approveAction: withAppBase('/auth/native/approve', base),
    csrfToken: getCookie(event, 'gitpulse_csrf') || event.context.gitpulseCsrfToken || '',
  };
}
