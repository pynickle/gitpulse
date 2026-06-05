export const DEFAULT_USER_SETTINGS_STORAGE_DRIVER = 'fs';
export const DEFAULT_USER_SETTINGS_FS_BASE = './.data/user-settings';
export const DEFAULT_USER_SETTINGS_UPSTASH_BASE = 'gitpulse:user-settings';
export const DEFAULT_USER_SETTINGS_UPSTASH_ENV_PREFIX = 'UPSTASH_REDIS_REST';

export type UserSettingsStorageDriver = 'fs' | 'upstash' | string;

export type UpstashRedisCredentials = {
  url: string;
  token: string;
};

export type UpstashRedisCredentialCandidate = {
  urlKey: string;
  tokenKey: string;
};

export const normalizeOptionalString = (value: string | undefined) => {
  const normalized = value?.trim();

  return normalized || undefined;
};

export const normalizeUserSettingsStorageDriver = (value: string | undefined) => {
  return normalizeOptionalString(value)?.toLowerCase() ?? DEFAULT_USER_SETTINGS_STORAGE_DRIVER;
};

export const defaultUserSettingsStorageBase = (driver: string) => {
  if (driver === 'fs') return DEFAULT_USER_SETTINGS_FS_BASE;
  if (driver === 'upstash') return DEFAULT_USER_SETTINGS_UPSTASH_BASE;

  return undefined;
};

const addPrefixedUpstashCredentialCandidates = (
  candidates: UpstashRedisCredentialCandidate[],
  prefix: string
) => {
  candidates.push(
    {
      urlKey: `${prefix}_KV_REST_API_URL`,
      tokenKey: `${prefix}_KV_REST_API_TOKEN`,
    },
    {
      urlKey: `${prefix}_URL`,
      tokenKey: `${prefix}_TOKEN`,
    }
  );
};

const uniqueUpstashCredentialCandidates = (candidates: UpstashRedisCredentialCandidate[]) => {
  return candidates.filter((candidate, index) => {
    return (
      candidates.findIndex((entry) => {
        return entry.urlKey === candidate.urlKey && entry.tokenKey === candidate.tokenKey;
      }) === index
    );
  });
};

export const getUpstashRedisCredentialCandidates = (
  env: Record<string, string | undefined>
): UpstashRedisCredentialCandidate[] => {
  const candidates: UpstashRedisCredentialCandidate[] = [];
  const explicitPrefix = normalizeOptionalString(
    env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX
  );

  if (explicitPrefix) {
    addPrefixedUpstashCredentialCandidates(candidates, explicitPrefix);
  }

  candidates.push(
    {
      urlKey: 'UPSTASH_REDIS_REST_URL',
      tokenKey: 'UPSTASH_REDIS_REST_TOKEN',
    },
    {
      urlKey: 'KV_REST_API_URL',
      tokenKey: 'KV_REST_API_TOKEN',
    }
  );

  if (explicitPrefix !== DEFAULT_USER_SETTINGS_UPSTASH_ENV_PREFIX) {
    addPrefixedUpstashCredentialCandidates(candidates, DEFAULT_USER_SETTINGS_UPSTASH_ENV_PREFIX);
  }

  return uniqueUpstashCredentialCandidates(candidates);
};

export function resolveOptionalUpstashRedisCredentials(
  env: Record<string, string | undefined>
): UpstashRedisCredentials | undefined {
  for (const candidate of getUpstashRedisCredentialCandidates(env)) {
    const url = normalizeOptionalString(env[candidate.urlKey]);
    const token = normalizeOptionalString(env[candidate.tokenKey]);

    if (url && token) {
      return { url, token };
    }
  }

  return undefined;
}

export function resolveUpstashRedisCredentials(
  env: Record<string, string | undefined>
): UpstashRedisCredentials {
  const credentials = resolveOptionalUpstashRedisCredentials(env);

  if (credentials) {
    return credentials;
  }

  throw new Error(
    'GitPulse user settings storage is configured for Upstash Redis, but no usable REST URL/token pair was found. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, KV_REST_API_URL and KV_REST_API_TOKEN, or configure NUXT_GITPULSE_USER_SETTINGS_STORAGE_UPSTASH_ENV_PREFIX for prefixed Vercel Storage variables.'
  );
}
