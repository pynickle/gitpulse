import { resolveAuthProviderState } from '../../utils/auth-providers';
import { establishGitHubSession } from '../../utils/auth-session-utils';
import { assertCsrfToken } from '../../utils/csrf-utils';
import { createGitHubClient } from '../../utils/github-auth-utils';

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

  const body = (await readBody(event)) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A GitHub token is required',
    });
  }

  try {
    const octokit = createGitHubClient(token);
    const { data: user } = await octokit.request('GET /user');

    await establishGitHubSession(event, 'pat', token, user);

    return {
      ok: true,
      user: {
        login: user.login,
        name: user.name ?? user.login,
        avatar_url: user.avatar_url ?? '',
      },
    };
  } catch (error: any) {
    const isUnauthorized = error?.status === 401;
    console.error(`[auth] Token validation failed: ${isUnauthorized ? 'unauthorized' : 'error'}`);

    throw createError({
      statusCode: isUnauthorized ? 401 : 500,
      statusMessage: isUnauthorized ? 'Invalid GitHub token' : 'Failed to validate GitHub token',
    });
  }
});
