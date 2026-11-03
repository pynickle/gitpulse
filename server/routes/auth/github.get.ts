import { deleteCookie, getCookie, getQuery, setCookie } from 'h3';
import type { RequestEvent } from 'nuxt/server';

import { normalizeAuthReturnTo, withAppBase } from '#shared/utils/auth-return-route';

import { resolveAuthProviderState } from '../../utils/auth-providers';
import {
  PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
  establishGitHubSession,
} from '../../utils/auth-session-utils';
import { resolveSessionReturnPath } from '../../utils/session-return-path';

const RETURN_TO_COOKIE = 'gitpulse_auth_return_to';

export default defineEventHandler(async (event) => {
  const baseUrl = useRuntimeConfig(event).app.baseURL;
  const query = getQuery(event);
  const isCallback = Boolean(query.code || query.error);
  const returnTo = resolveSessionReturnPath(
    normalizeAuthReturnTo(isCallback ? getCookie(event, RETURN_TO_COOKIE) : query.returnTo)
  );

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

  const providerState = resolveAuthProviderState(event);

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

  // nuxt-auth-utils types its OAuth handler against the portable `nuxt/server`
  // event, while this handler is defined with h3. Nitro hands the very same
  // request event to it, so the bridge is type-level only.
  return githubOAuthHandler(event as unknown as RequestEvent);
});
