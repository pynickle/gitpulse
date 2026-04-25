import type { AuthProviderMode, AuthProviderState } from '#shared/types/auth-provider';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

export const AUTH_PROVIDER_CONFIGURATION_ERROR =
  'GitPulse auth configuration is invalid: both PAT token input and GitHub OAuth are disabled. Enable AUTH_PAT_ENABLED or AUTH_GITHUB_OAUTH_ENABLED before starting the app.';

export const AUTH_PERSONAL_MODE_CONFIGURATION_ERROR =
  'GitPulse auth configuration is invalid: personal mode requires non-empty NUXT_GIT_PULSE_AUTH_PERSONAL_PAT, NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD, and NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET (formerly AUTH_PERSONAL_PAT, AUTH_PERSONAL_PASSWORD, AUTH_PERSONAL_COOKIE_SECRET) values before starting the app.';

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (ENABLED_VALUES.has(normalized)) return true;
    if (DISABLED_VALUES.has(normalized)) return false;
  }

  return defaultValue;
}

function hasNonBlankString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveMode(
  personalMode: boolean,
  patEnabled: boolean,
  oauthEnabled: boolean
): AuthProviderMode {
  if (personalMode) return 'personal';
  if (patEnabled && oauthEnabled) return 'hybrid';
  if (oauthEnabled) return 'oauth-only';
  return 'pat-only';
}

export function resolveAuthProviderState(): AuthProviderState {
  const runtimeConfig = useRuntimeConfig() as {
    gitPulseAuth?: {
      personalModeEnabled?: string | boolean;
      patEnabled?: string | boolean;
      githubOAuthEnabled?: string | boolean;
      githubOAuthRequested?: string | boolean;
      githubOAuthEnvReady?: string | boolean;
      personalPat?: string;
      personalPassword?: string;
      personalCookieSecret?: string;
    };
  };
  const personalMode = normalizeBoolean(runtimeConfig.gitPulseAuth?.personalModeEnabled, false);
  const patEnabled = normalizeBoolean(runtimeConfig.gitPulseAuth?.patEnabled, true);
  const oauthRequested = normalizeBoolean(runtimeConfig.gitPulseAuth?.githubOAuthRequested, false);
  const oauthEnvReady = normalizeBoolean(runtimeConfig.gitPulseAuth?.githubOAuthEnvReady, false);
  const oauthEnabled = normalizeBoolean(runtimeConfig.gitPulseAuth?.githubOAuthEnabled, false);
  const warnings: string[] = [];

  if (
    personalMode &&
    (!hasNonBlankString(runtimeConfig.gitPulseAuth?.personalPat) ||
      !hasNonBlankString(runtimeConfig.gitPulseAuth?.personalPassword) ||
      !hasNonBlankString(runtimeConfig.gitPulseAuth?.personalCookieSecret))
  ) {
    throw new Error(AUTH_PERSONAL_MODE_CONFIGURATION_ERROR);
  }

  if (oauthRequested && !oauthEnvReady) {
    warnings.push(
      'GitHub OAuth is enabled by configuration, but NUXT_OAUTH_GITHUB_CLIENT_ID or NUXT_OAUTH_GITHUB_CLIENT_SECRET is missing. OAuth has been disabled for this runtime.'
    );
  }

  return {
    personalMode,
    patEnabled,
    oauthEnabled: personalMode ? false : oauthEnabled,
    oauthRequested: personalMode ? false : oauthRequested,
    oauthEnvReady,
    hasAvailableProvider: personalMode ? false : patEnabled || oauthEnabled,
    mode: resolveMode(personalMode, patEnabled, oauthEnabled),
    warnings,
  };
}

export function assertAuthProviderState(): AuthProviderState {
  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    return providerState;
  }

  if (!providerState.hasAvailableProvider) {
    throw new Error(AUTH_PROVIDER_CONFIGURATION_ERROR);
  }

  return providerState;
}
