import { resolveAuthProviderState } from '../../utils/auth-providers';
import { establishGitHubSession } from '../../utils/auth-session-utils';

const githubOAuthHandler = defineOAuthGitHubEventHandler({
  config: {
    scope: ['notifications', 'read:user', 'read:org', 'project', 'repo'],
  },
  async onSuccess(event, { user, tokens }) {
    await establishGitHubSession(event, 'github', tokens.access_token, user);
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
