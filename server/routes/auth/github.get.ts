import { resolveAuthProviderState } from '../../utils/auth-providers';
import {
  PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
  establishGitHubSession,
} from '../../utils/auth-session-utils';

const githubOAuthHandler = defineOAuthGitHubEventHandler({
  config: {
    scope: ['notifications', 'read:user', 'read:org', 'read:packages', 'project', 'repo'],
  },
  async onSuccess(event, { user, tokens }) {
    await establishGitHubSession(event, 'github', tokens.access_token, user, {
      maxAge: PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
    });
    return sendRedirect(event, '/dashboard');
  },
  onError(event, _error) {
    console.error('[auth] OAuth error occurred');
    return sendRedirect(event, '/?error=auth_failed');
  },
});

export default defineEventHandler(async (event) => {
  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    throw createError({
      statusCode: 403,
      statusMessage: 'GitHub OAuth authentication is not available in personal mode',
    });
  }

  if (!providerState.oauthEnabled) {
    return sendRedirect(event, '/?error=oauth_unavailable');
  }

  return githubOAuthHandler(event);
});
