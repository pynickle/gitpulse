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
  onError(event, error) {
    console.error('GitHub OAuth error:', error);
    return sendRedirect(event, '/?error=auth_failed');
  },
});

export default defineEventHandler(async (event) => {
  const providerState = resolveAuthProviderState();

  if (!providerState.oauthEnabled) {
    return sendRedirect(event, '/?error=oauth_unavailable');
  }

  return githubOAuthHandler(event);
});
