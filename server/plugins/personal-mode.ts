import { resolveAuthProviderState } from '../utils/auth-providers';
import { createGitHubClient } from '../utils/github-auth-utils';
import { cachePersonalModeIdentity } from '../utils/personal-mode-utils';

interface PersonalModeIdentity {
  id?: number;
  login: string;
  name: string;
  avatar_url: string;
}

const PERSONAL_MODE_STORAGE_BASE = 'personal-mode';
const PERSONAL_MODE_IDENTITY_KEY = 'identity';
const PERSONAL_MODE_STARTUP_FAILURE =
  'GitPulse personal mode failed to start: NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN (formerly AUTH_PERSONAL_TOKEN) could not be validated against GitHub. Confirm the token is current and allowed to access GitHub user identity.';

function createPersonalModeStartupError(): Error {
  return createError({
    statusCode: 500,
    fatal: true,
    statusMessage: PERSONAL_MODE_STARTUP_FAILURE,
  });
}

function getGitHubErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }

  return typeof error.status === 'number' ? error.status : undefined;
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
      githubToken?: string;
    };
  };
  const personalPat = runtimeConfig.gitPulseAuth?.githubToken?.trim() ?? '';

  if (!personalPat) {
    console.error(
      '[auth] Personal mode startup validation failed: NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN is missing.'
    );
    throw createPersonalModeStartupError();
  }

  try {
    const octokit = createGitHubClient(personalPat);
    const { data: user } = await octokit.request('GET /user');
    const identity: PersonalModeIdentity = {
      id: Number(user.id),
      login: user.login,
      name: user.name ?? user.login,
      avatar_url: user.avatar_url ?? '',
    };

    cachePersonalModeIdentity(identity);
    await useStorage(PERSONAL_MODE_STORAGE_BASE).setItem(PERSONAL_MODE_IDENTITY_KEY, identity);

    console.info(`[auth] Personal mode token validated for @${identity.login}.`);
  } catch (error: unknown) {
    const status = getGitHubErrorStatus(error);
    const statusSuffix = status === undefined ? '' : ` (GitHub status ${status})`;

    console.error(`[auth] Personal mode startup validation failed${statusSuffix}.`);
    throw createPersonalModeStartupError();
  }
});
