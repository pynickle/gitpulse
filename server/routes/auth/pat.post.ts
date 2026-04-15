import { resolveAuthProviderState } from '../../utils/auth-providers';
import { establishGitHubSession } from '../../utils/auth-session-utils';
import { createGitHubClient } from '../../utils/github-auth-utils';

export default defineEventHandler(async (event) => {
  const providerState = resolveAuthProviderState();

  if (!providerState.patEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Personal access token authentication is disabled',
    });
  }

  const body = (await readBody(event)) as { token?: unknown };
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A GitHub personal access token is required',
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
    console.error('GitHub PAT auth error:', error);

    const isUnauthorized = error?.status === 401;

    throw createError({
      statusCode: isUnauthorized ? 401 : 500,
      statusMessage: isUnauthorized
        ? 'Invalid GitHub personal access token'
        : 'Failed to validate GitHub personal access token',
    });
  }
});
