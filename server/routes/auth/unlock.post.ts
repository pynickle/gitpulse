import { parsePersonalUnlockBody } from '../../utils/auth-request-validation-utils';
import { establishGitHubSession } from '../../utils/auth-session-utils';
import { assertCsrfToken } from '../../utils/csrf-utils';
import {
  clearRememberDeviceCookie,
  createRememberDeviceCookie,
  getPersonalModeIdentity,
  verifyPersonalPassword,
  verifyRememberDeviceCookie,
} from '../../utils/personal-mode-utils';

function getGithubTokenFromRuntimeConfig(): string {
  const runtimeConfig = useRuntimeConfig() as {
    gitPulseAuth?: {
      githubToken?: string;
    };
  };

  return typeof runtimeConfig.gitPulseAuth?.githubToken === 'string'
    ? runtimeConfig.gitPulseAuth.githubToken.trim()
    : '';
}

function getSessionUserResponse(user: {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}) {
  return {
    login: user.login,
    name: user.name ?? user.login,
    avatar_url: user.avatar_url ?? '',
  };
}

export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/unlock');

  const body = parsePersonalUnlockBody(await readBody(event));
  const githubToken = getGithubTokenFromRuntimeConfig();
  const identity = getPersonalModeIdentity();

  if (!githubToken || !identity) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Personal mode unlock is unavailable',
    });
  }

  const session = await getUserSession(event);
  const hasActiveSession = Boolean(session.secure?.access_token && session.user?.login);

  if (!hasActiveSession && verifyRememberDeviceCookie(event)) {
    await establishGitHubSession(event, 'pat', githubToken, identity);

    return {
      ok: true,
      user: getSessionUserResponse(identity),
    };
  }

  if (!body.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required',
    });
  }

  if (!verifyPersonalPassword(body.password)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid password',
    });
  }

  await establishGitHubSession(event, 'pat', githubToken, identity);

  if (body.remember) {
    createRememberDeviceCookie(event);
  } else {
    clearRememberDeviceCookie(event);
  }

  return {
    ok: true,
    user: getSessionUserResponse(identity),
  };
});
