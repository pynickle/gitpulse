import { deleteCookie, getCookie, getQuery, setCookie } from 'h3';

import {
  DEFAULT_AUTH_RETURN_PATH,
  normalizeAuthReturnTo,
  withAppBase,
} from '#shared/utils/auth-return-route';

import { resolveAuthProviderState } from '../../utils/auth-providers';
import {
  PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
  establishGitHubSession,
} from '../../utils/auth-session-utils';

const RETURN_TO_COOKIE = 'gitpulse_auth_return_to';

export default defineEventHandler(async (event) => {
  const baseUrl = useRuntimeConfig().app.baseURL;
  const query = getQuery(event);
  const isCallback = Boolean(query.code || query.error);
  const returnTo =
    normalizeAuthReturnTo(isCallback ? getCookie(event, RETURN_TO_COOKIE) : query.returnTo) ??
    DEFAULT_AUTH_RETURN_PATH;

  if (!isCallback) {
    setCookie(event, RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
  }

  const redirectAfterAuth = (error?: string) => {
    deleteCookie(event, RETURN_TO_COOKIE, { path: '/' });

    if (error) {
      const search = new URLSearchParams({ error, returnTo });
      return sendRedirect(event, `${withAppBase('/', baseUrl)}?${search.toString()}`);
    }

    return sendRedirect(event, withAppBase(returnTo, baseUrl));
  };

  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    throw createError({
      statusCode: 403,
      statusMessage: 'GitHub OAuth authentication is not available in personal mode',
    });
  }

  if (!providerState.oauthEnabled) {
    return redirectAfterAuth('oauth_unavailable');
  }

  const githubOAuthHandler = defineOAuthGitHubEventHandler({
    config: {
      scope: ['notifications', 'read:user', 'read:org', 'read:packages', 'project', 'repo'],
    },
    async onSuccess(authEvent, { user, tokens }) {
      await establishGitHubSession(authEvent, 'github', tokens.access_token, user, {
        maxAge: PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
      });
      return redirectAfterAuth();
    },
    onError() {
      console.error('[auth] OAuth error occurred');
      return redirectAfterAuth('auth_failed');
    },
  });

  return githubOAuthHandler(event);
});
