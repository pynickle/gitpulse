import { createHmac, timingSafeEqual } from 'node:crypto';

import type { H3Event } from 'h3';
import { deleteCookie, getCookie, setCookie } from 'h3';

export interface PersonalIdentity {
  login: string;
  name: string;
  avatar_url: string;
}

interface RememberCookiePayload {
  iat: number;
  exp: number;
  fp: string;
}

const PERSONAL_REMEMBER_COOKIE = 'gitpulse_personal_remember';
const REMEMBER_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const REMEMBER_COOKIE_PATH = '/';
const PERSONAL_MODE_STORAGE_BASE = 'personal-mode';
const PERSONAL_MODE_IDENTITY_KEY = 'identity';

let personalIdentityCache: PersonalIdentity | null = null;

function normalizeSecret(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getPersonalAuthConfig() {
  const runtimeConfig = useRuntimeConfig() as {
    gitPulseAuth?: {
      personalPassword?: string;
      personalCookieSecret?: string;
    };
  };

  return {
    personalPassword: normalizeSecret(runtimeConfig.gitPulseAuth?.personalPassword),
    personalCookieSecret: normalizeSecret(runtimeConfig.gitPulseAuth?.personalCookieSecret),
  };
}

function getCookieSecurityOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: REMEMBER_COOKIE_PATH,
    maxAge: REMEMBER_COOKIE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  };
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

const PERSONAL_REMEMBER_FINGERPRINT_DOMAIN = 'gitpulse:personal-remember:fp:v1|';
const MIN_COOKIE_SECRET_BYTES = 32;

function fingerprintForPassword(password: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${PERSONAL_REMEMBER_FINGERPRINT_DOMAIN}${password}`)
    .digest('base64url');
}

export function assertPersonalCookieSecretStrength(): void {
  const { personalCookieSecret } = getPersonalAuthConfig();
  const byteLength = Buffer.byteLength(personalCookieSecret, 'utf8');

  if (byteLength >= MIN_COOKIE_SECRET_BYTES) {
    return;
  }

  const message = `[auth] NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET (formerly AUTH_PERSONAL_COOKIE_SECRET) must be at least ${MIN_COOKIE_SECRET_BYTES} bytes (got ${byteLength}).`;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  console.warn(message);
}

function signRememberPayload(payload: RememberCookiePayload, secret: string): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${toBase64Url(signature)}`;
}

function verifySignedRememberPayload(value: string, secret: string): RememberCookiePayload | null {
  const [encodedPayload, encodedSignature] = value.split('.');

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest();
  const actualSignature = Buffer.from(encodedSignature, 'base64url');

  if (expectedSignature.length !== actualSignature.length) {
    return null;
  }

  if (!timingSafeEqual(expectedSignature, actualSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as
      | RememberCookiePayload
      | undefined;

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    if (
      typeof payload.iat !== 'number' ||
      !Number.isFinite(payload.iat) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      typeof payload.fp !== 'string' ||
      !payload.fp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function cachePersonalModeIdentity(identity: PersonalIdentity) {
  personalIdentityCache = {
    login: identity.login,
    name: identity.name,
    avatar_url: identity.avatar_url,
  };
}

export function getPersonalModeIdentity(): PersonalIdentity | null {
  return personalIdentityCache;
}

export function verifyPersonalPassword(input: string): boolean {
  const { personalPassword } = getPersonalAuthConfig();
  const normalizedInput = typeof input === 'string' ? input : '';

  if (!personalPassword || !normalizedInput) {
    return false;
  }

  return constantTimeStringEqual(personalPassword, normalizedInput);
}

export function createRememberDeviceCookie(event: H3Event): void {
  const { personalPassword, personalCookieSecret } = getPersonalAuthConfig();

  if (!personalPassword || !personalCookieSecret) {
    return;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: RememberCookiePayload = {
    iat: issuedAt,
    exp: issuedAt + REMEMBER_COOKIE_MAX_AGE_SECONDS,
    fp: fingerprintForPassword(personalPassword, personalCookieSecret),
  };

  const signedValue = signRememberPayload(payload, personalCookieSecret);

  setCookie(event, PERSONAL_REMEMBER_COOKIE, signedValue, {
    ...getCookieSecurityOptions(),
    expires: new Date(payload.exp * 1000),
  });
}

export function clearRememberDeviceCookie(event: H3Event): void {
  deleteCookie(event, PERSONAL_REMEMBER_COOKIE, {
    ...getCookieSecurityOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export function verifyRememberDeviceCookie(event: H3Event): boolean {
  const cookieValue = getCookie(event, PERSONAL_REMEMBER_COOKIE);
  const { personalPassword, personalCookieSecret } = getPersonalAuthConfig();

  if (!cookieValue || !personalPassword || !personalCookieSecret) {
    if (cookieValue) {
      clearRememberDeviceCookie(event);
    }

    return false;
  }

  const payload = verifySignedRememberPayload(cookieValue, personalCookieSecret);

  if (!payload) {
    clearRememberDeviceCookie(event);
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > payload.exp) {
    clearRememberDeviceCookie(event);
    return false;
  }

  const expectedFingerprint = fingerprintForPassword(personalPassword, personalCookieSecret);

  if (!constantTimeStringEqual(payload.fp, expectedFingerprint)) {
    clearRememberDeviceCookie(event);
    return false;
  }

  return true;
}
