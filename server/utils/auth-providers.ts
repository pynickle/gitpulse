import type { H3Event } from 'h3';

import type { AuthProviderMode, AuthProviderState } from '#shared/types/auth-provider';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

export const AUTH_PROVIDER_CONFIGURATION_ERROR =
  'GitPulse auth configuration is invalid: both token input and GitHub OAuth are disabled. Enable AUTH_PAT_ENABLED or AUTH_GITHUB_OAUTH_ENABLED before starting the app.';

export const AUTH_PERSONAL_MODE_CONFIGURATION_ERROR =
  'GitPulse auth configuration is invalid: personal mode requires non-empty NUXT_GITPULSE_AUTH_GITHUB_TOKEN, NUXT_GITPULSE_AUTH_PERSONAL_PASSWORD, and NUXT_GITPULSE_AUTH_PERSONAL_COOKIE_SECRET (formerly AUTH_PERSONAL_TOKEN, AUTH_PERSONAL_PASSWORD, AUTH_PERSONAL_COOKIE_SECRET) values before starting the app.';

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

type GitpulseAuthRuntimeConfig = {
  personalModeEnabled?: string | boolean;
  tokenEnabled?: string | boolean;
  githubOAuthEnabled?: string | boolean;
  githubOAuthRequested?: string | boolean;
  githubOAuthEnvReady?: string | boolean;
  githubToken?: string;
  personalPassword?: string;
  personalCookieSecret?: string;
};

const LEGACY_GIT_PULSE_AUTH_ENV = {
  githubToken: 'NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN',
  personalPassword: 'NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD',
  personalCookieSecret: 'NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET',
} as const;

function isBlankSecret(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  );
}

function preferConfiguredSecret(current: unknown, legacyEnvName: string): string | undefined {
  if (!isBlankSecret(current)) {
    return current as string;
  }

  const legacy = process.env[legacyEnvName];
  if (typeof legacy === 'string') return legacy;
  return typeof current === 'string' ? current : undefined;
}

export function getGitpulseAuthConfig(event?: H3Event): GitpulseAuthRuntimeConfig {
  const runtimeConfig = useRuntimeConfig(event) as {
    gitpulseAuth?: GitpulseAuthRuntimeConfig;
  };
  const current = runtimeConfig.gitpulseAuth ?? {};

  return {
    ...current,
    githubToken: preferConfiguredSecret(current.githubToken, LEGACY_GIT_PULSE_AUTH_ENV.githubToken),
    personalPassword: preferConfiguredSecret(
      current.personalPassword,
      LEGACY_GIT_PULSE_AUTH_ENV.personalPassword
    ),
    personalCookieSecret: preferConfiguredSecret(
      current.personalCookieSecret,
      LEGACY_GIT_PULSE_AUTH_ENV.personalCookieSecret
    ),
  };
}

function resolveMode(
  personalMode: boolean,
  tokenEnabled: boolean,
  oauthEnabled: boolean
): AuthProviderMode {
  if (personalMode) return 'personal';
  if (tokenEnabled && oauthEnabled) return 'hybrid';
  if (oauthEnabled) return 'oauth-only';
  return 'pat-only';
}

export function resolveAuthProviderState(event?: H3Event): AuthProviderState {
  const gitpulseAuth = getGitpulseAuthConfig(event);
  const personalMode = normalizeBoolean(gitpulseAuth.personalModeEnabled, false);
  const tokenEnabled = normalizeBoolean(gitpulseAuth.tokenEnabled, true);
  const oauthRequested = normalizeBoolean(gitpulseAuth.githubOAuthRequested, false);
  const oauthEnvReady = normalizeBoolean(gitpulseAuth.githubOAuthEnvReady, false);
  const oauthEnabled = normalizeBoolean(gitpulseAuth.githubOAuthEnabled, false);
  const warnings: string[] = [];

  if (
    personalMode &&
    (!hasNonBlankString(gitpulseAuth.githubToken) ||
      !hasNonBlankString(gitpulseAuth.personalPassword) ||
      !hasNonBlankString(gitpulseAuth.personalCookieSecret))
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
    patEnabled: personalMode ? false : tokenEnabled,
    oauthEnabled: personalMode ? false : oauthEnabled,
    oauthRequested: personalMode ? false : oauthRequested,
    oauthEnvReady,
    hasAvailableProvider: personalMode ? false : tokenEnabled || oauthEnabled,
    mode: resolveMode(personalMode, tokenEnabled, oauthEnabled),
    warnings,
  };
}

export function assertAuthProviderState(event?: H3Event): AuthProviderState {
  const providerState = resolveAuthProviderState(event);

  if (providerState.personalMode) {
    return providerState;
  }

  if (!providerState.hasAvailableProvider) {
    throw new Error(AUTH_PROVIDER_CONFIGURATION_ERROR);
  }

  return providerState;
}
