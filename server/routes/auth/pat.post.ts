import { resolveAuthProviderState } from '../../utils/auth-providers';
import { parseTokenAuthBody } from '../../utils/auth-request-validation-utils';
import {
  PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
  establishGitHubSession,
} from '../../utils/auth-session-utils';
import { assertCsrfToken } from '../../utils/csrf-utils';
import { createGitHubClient } from '../../utils/github-auth-utils';

function isGitHubUnauthorizedError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'status' in error && error.status === 401;
}

export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/pat');

  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Token authentication is not available in personal mode',
    });
  }

  if (!providerState.patEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Token authentication is disabled',
    });
  }

  const token = parseTokenAuthBody(await readBody(event));

  try {
    const octokit = createGitHubClient(token);
    const { data: user } = await octokit.request('GET /user');

    await establishGitHubSession(event, 'pat', token, user, {
      maxAge: PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
    });

    return {
      ok: true,
      user: {
        login: user.login,
        name: user.name ?? user.login,
        avatar_url: user.avatar_url ?? '',
      },
    };
  } catch (error: unknown) {
    const isUnauthorized = isGitHubUnauthorizedError(error);
    console.error(`[auth] Token validation failed: ${isUnauthorized ? 'unauthorized' : 'error'}`);

    throw createError({
      statusCode: isUnauthorized ? 401 : 500,
      statusMessage: isUnauthorized ? 'Invalid GitHub token' : 'Failed to validate GitHub token',
    });
  }
});
