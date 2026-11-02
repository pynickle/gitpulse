/**
 * Canonical origin is NUXT_SITE_URL, read when the process starts.
 * nuxt.config must not default it: a value written there is fixed at image
 * build, and this image is built without the origin. Production refuses to
 * serve when the variable is missing or is not an origin. Development warns.
 */

export const CANONICAL_ORIGIN_ENV = 'NUXT_SITE_URL';
export const RETIRED_CANONICAL_ORIGIN_ENV = 'NUXT_PUBLIC_SITE_URL';

export interface CanonicalOriginEnv {
  NODE_ENV?: string;
  NUXT_SITE_URL?: unknown;
  NUXT_PUBLIC_SITE_URL?: unknown;
  [key: string]: unknown;
}

export interface CanonicalOriginRuntimeConfig {
  public: {
    i18n?: {
      baseUrl?: unknown;
    };
  };
}

type CanonicalOriginFailure = {
  ok: false;
  reason: string;
};

type CanonicalOriginSuccess = {
  ok: true;
  origin: string;
};

export function parseCanonicalOrigin(
  value: unknown
): CanonicalOriginFailure | CanonicalOriginSuccess {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'It is missing.' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, reason: 'It is empty.' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'It is not an absolute URL.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'It must use http or https.' };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'It must not include credentials.' };
  }

  if (url.pathname !== '/' && url.pathname !== '') {
    return { ok: false, reason: 'It must not include a path.' };
  }

  if (url.search) {
    return { ok: false, reason: 'It must not include a query.' };
  }

  if (url.hash) {
    return { ok: false, reason: 'It must not include a hash.' };
  }

  return { ok: true, origin: `${url.protocol}//${url.host}` };
}

function failCanonicalOrigin(message: string, production: boolean): void {
  if (production) {
    throw new Error(message);
  }

  console.warn(message);
}

/**
 * Reads NUXT_SITE_URL. Production throws when it is missing or not an origin.
 * Development warns and returns undefined. This does not write runtime config:
 * the shared config object is frozen after environment overrides are applied.
 */
export function resolveCanonicalOrigin(env: CanonicalOriginEnv): string | undefined {
  const production = env.NODE_ENV === 'production';
  const retired =
    typeof env.NUXT_PUBLIC_SITE_URL === 'string' ? env.NUXT_PUBLIC_SITE_URL.trim() : '';

  if (retired) {
    failCanonicalOrigin(
      `[site] ${RETIRED_CANONICAL_ORIGIN_ENV} is not read. Set ${CANONICAL_ORIGIN_ENV} to this deployment's origin and unset ${RETIRED_CANONICAL_ORIGIN_ENV}.`,
      production
    );
  }

  const parsed = parseCanonicalOrigin(env.NUXT_SITE_URL);
  if (!parsed.ok) {
    failCanonicalOrigin(
      `[site] ${CANONICAL_ORIGIN_ENV} must be an absolute http(s) origin with no path, query, or hash. ${parsed.reason}`,
      production
    );
    return undefined;
  }

  return parsed.origin;
}

export function applyCanonicalOrigin(
  runtimeConfig: CanonicalOriginRuntimeConfig,
  origin: string
): void {
  const i18n = runtimeConfig.public.i18n;
  if (!i18n) {
    throw new Error(
      '[site] i18n runtime config is missing, so locale alternates cannot use the canonical origin.'
    );
  }

  i18n.baseUrl = origin;
}

/** Validates the environment and copies a present origin onto a mutable runtime config. */
export function installCanonicalOrigin(
  runtimeConfig: CanonicalOriginRuntimeConfig,
  env: CanonicalOriginEnv
): string | undefined {
  const origin = resolveCanonicalOrigin(env);
  if (!origin) return undefined;

  applyCanonicalOrigin(runtimeConfig, origin);
  return origin;
}
