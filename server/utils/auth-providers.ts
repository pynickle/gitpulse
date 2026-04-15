import type { AuthProviderMode, AuthProviderState } from '#shared/types/auth-provider';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

export const AUTH_PROVIDER_CONFIGURATION_ERROR =
  'GitPulse auth configuration is invalid: both PAT token input and GitHub OAuth are disabled. Enable AUTH_PAT_ENABLED or AUTH_GITHUB_OAUTH_ENABLED before starting the app.';

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (ENABLED_VALUES.has(normalized)) return true;
    if (DISABLED_VALUES.has(normalized)) return false;
  }

  return defaultValue;
}

function resolveMode(patEnabled: boolean, oauthEnabled: boolean): AuthProviderMode {
  if (patEnabled && oauthEnabled) return 'hybrid';
  if (oauthEnabled) return 'oauth-only';
  return 'pat-only';
}

export function resolveAuthProviderState(): AuthProviderState {
  const runtimeConfig = useRuntimeConfig() as {
    gitPulseAuth?: {
      patEnabled?: string | boolean;
      githubOAuthEnabled?: string | boolean;
      githubOAuthRequested?: string | boolean;
      githubOAuthEnvReady?: string | boolean;
    };
  };
  const patEnabled = normalizeBoolean(runtimeConfig.gitPulseAuth?.patEnabled, true);
  const oauthRequested = normalizeBoolean(runtimeConfig.gitPulseAuth?.githubOAuthRequested, false);
  const oauthEnvReady = normalizeBoolean(runtimeConfig.gitPulseAuth?.githubOAuthEnvReady, false);
  const oauthEnabled = normalizeBoolean(runtimeConfig.gitPulseAuth?.githubOAuthEnabled, false);
  const warnings: string[] = [];

  if (oauthRequested && !oauthEnvReady) {
    warnings.push(
      'GitHub OAuth is enabled by configuration, but NUXT_OAUTH_GITHUB_CLIENT_ID or NUXT_OAUTH_GITHUB_CLIENT_SECRET is missing. OAuth has been disabled for this runtime.'
    );
  }

  return {
    patEnabled,
    oauthEnabled,
    oauthRequested,
    oauthEnvReady,
    hasAvailableProvider: patEnabled || oauthEnabled,
    mode: resolveMode(patEnabled, oauthEnabled),
    warnings,
  };
}

export function assertAuthProviderState(): AuthProviderState {
  const providerState = resolveAuthProviderState();

  if (!providerState.hasAvailableProvider) {
    throw new Error(AUTH_PROVIDER_CONFIGURATION_ERROR);
  }

  return providerState;
}
