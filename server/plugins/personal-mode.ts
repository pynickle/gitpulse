import { resolveAuthProviderState } from '../utils/auth-providers';
import { createGitHubClient } from '../utils/github-auth-utils';
import { cachePersonalModeIdentity } from '../utils/personal-mode-utils';

interface PersonalModeIdentity {
  login: string;
  name: string;
  avatar_url: string;
}

const PERSONAL_MODE_STORAGE_BASE = 'personal-mode';
const PERSONAL_MODE_IDENTITY_KEY = 'identity';
const PERSONAL_MODE_STARTUP_FAILURE =
  'GitPulse personal mode failed to start: NUXT_GIT_PULSE_AUTH_PERSONAL_PAT (formerly AUTH_PERSONAL_PAT) could not be validated against GitHub. Confirm the token is current and allowed to access GitHub user identity.';

function createPersonalModeStartupError(): Error {
  return createError({
    statusCode: 500,
    fatal: true,
    statusMessage: PERSONAL_MODE_STARTUP_FAILURE,
  });
}

export default defineNitroPlugin(async (_nitroApp) => {
  if (import.meta.prerender) {
    return;
  }

  const providerState = resolveAuthProviderState();

  if (!providerState.personalMode) {
    return;
  }

  const runtimeConfig = useRuntimeConfig() as {
    gitPulseAuth?: {
      personalPat?: string;
    };
  };
  const personalPat = runtimeConfig.gitPulseAuth?.personalPat?.trim() ?? '';

  if (!personalPat) {
    console.error(
      '[auth] Personal mode startup validation failed: NUXT_GIT_PULSE_AUTH_PERSONAL_PAT (formerly AUTH_PERSONAL_PAT) is missing.'
    );
    throw createPersonalModeStartupError();
  }

  try {
    const octokit = createGitHubClient(personalPat);
    const { data: user } = await octokit.request('GET /user');
    const identity: PersonalModeIdentity = {
      login: user.login,
      name: user.name ?? user.login,
      avatar_url: user.avatar_url ?? '',
    };

    cachePersonalModeIdentity(identity);
    await useStorage(PERSONAL_MODE_STORAGE_BASE).setItem(PERSONAL_MODE_IDENTITY_KEY, identity);

    console.info(`[auth] Personal mode PAT validated for @${identity.login}.`);
  } catch (error: any) {
    const statusSuffix =
      typeof error?.status === 'number' ? ` (GitHub status ${error.status})` : '';

    console.error(`[auth] Personal mode startup validation failed${statusSuffix}.`);
    throw createPersonalModeStartupError();
  }
});
