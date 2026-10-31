import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { open, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { createError, getRequestURL, setHeader, type H3Event } from 'h3';
import { deriveSecret } from 'nuxt/server';
import * as z from 'zod';

import { withAppBase } from '#shared/utils/auth-return-route';
import {
  DEFAULT_USER_SETTINGS_FS_BASE,
  normalizeUserSettingsStorageDriver,
} from '#shared/utils/user-settings-storage-env';

import { MIN_APP_SECRET_LENGTH } from './app-secret-utils';
import { resolveAuthProviderState } from './auth-providers';
import {
  getUserSettingsItemKey,
  getUserSettingsStorageAdapter,
} from './user-settings-storage-utils';
import { parseZodRequestBody } from './zod-validation-utils';

const LIFETIME_MS = 10 * 60 * 1000;
const COLLECTION = 'native-login-handoff';
const secretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const idSchema = z.strictObject({ id: secretSchema });
const proofSchema = idSchema.extend({
  verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  origin: z.string().url(),
});
const browserSchema = idSchema.extend({ browserToken: secretSchema });
type Status = 'pending' | 'approved' | 'cancelled' | 'expired' | 'redeemed';
type Grant = {
  // Grants approved before provider preservation was added contain only OAuth credentials.
  authProvider?: 'github' | 'pat';
  accessToken: string;
  user: { id?: number; login: string; name: string; avatar_url: string };
};
interface Transaction {
  origin: string;
  challenge: string;
  browserHash: string;
  expiresAt: number;
  status: Status;
  grant?: string;
}

function sessionSecret(event: H3Event) {
  return useRuntimeConfig(event).appSecret || '';
}

// `deriveSecret` is Nuxt's HKDF-SHA256 helper: one `appSecret` root yields an
// independent key per purpose. The grant gets its own purpose, so it is never
// sealed with the session key and a grant can never be mistaken for a session
// cookie. It throws when `appSecret` is unset or short; every handoff route
// calls `assertNativeLoginHandoffAvailable` first, which rejects that case.
async function handoffKey() {
  return createHash('sha256')
    .update(await deriveSecret('gitpulse:native-login-handoff'))
    .digest();
}

export function nativeLoginHandoffAvailable(event: H3Event) {
  const providers = resolveAuthProviderState(event);
  const secret = sessionSecret(event);
  return (
    !providers.personalMode &&
    providers.oauthEnabled &&
    ['fs', 'redis', 'upstash'].includes(
      normalizeUserSettingsStorageDriver(process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER)
    ) &&
    typeof secret === 'string' &&
    secret.length >= MIN_APP_SECRET_LENGTH
  );
}

export function assertNativeLoginHandoffAvailable(event: H3Event) {
  setHeader(event, 'Cache-Control', 'no-store');
  // `no-referrer` would make the browser serialize the approval form's Origin
  // as the literal `null`, which the double-submit check rejects. `same-origin`
  // keeps the app sign-in identifiers out of cross-origin referrers (the OAuth
  // link to GitHub sends none) while still sending a real Origin here.
  setHeader(event, 'Referrer-Policy', 'same-origin');
  if (!nativeLoginHandoffAvailable(event)) {
    throw createError({ statusCode: 503, statusMessage: 'Native browser sign-in is unavailable' });
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function matches(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function seal(grant: Grant) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', await handoffKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(grant), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

async function unseal(value: string): Promise<Grant> {
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', await handoffKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
  ) as Grant;
}

// Redis adapters fence commits with a remote lock. The filesystem adapter also
// needs an OS-visible lock so multiple Nitro workers cannot consume one grant.
async function withTransactionLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  const driver = normalizeUserSettingsStorageDriver(
    process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER
  );
  if (driver !== 'fs') return action();
  const directory = join(
    process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE || DEFAULT_USER_SETTINGS_FS_BASE,
    '.native-login-locks'
  );
  await mkdir(directory, { recursive: true });
  // Storage canonicalizes identifiers. Every spelling of the same storage key
  // must also acquire the same lock on case-sensitive filesystems.
  const path = join(directory, `${hash(getUserSettingsItemKey(id, COLLECTION))}.lock`);
  let lock;
  for (let attempt = 0; !lock && attempt < 40; attempt++) {
    try {
      lock = await open(path, 'wx');
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  if (!lock)
    throw createError({ statusCode: 503, statusMessage: 'Sign-in transaction is busy; retry' });
  try {
    return await action();
  } finally {
    await lock.close();
    await unlink(path);
  }
}

async function update<T>(
  id: string,
  action: (transaction: Transaction) => T | Promise<T>
): Promise<T> {
  return withTransactionLock(id, async () => {
    let result!: T;
    let expired = false;
    await getUserSettingsStorageAdapter<Transaction>(COLLECTION).update(id, async (current) => {
      if (!current)
        throw createError({ statusCode: 404, statusMessage: 'Unknown sign-in attempt' });
      if (current.expiresAt <= Date.now()) {
        expired = true;
        return { ...current, status: 'expired', grant: undefined };
      }
      // The action mutates `current` in place and may await; its result is
      // returned to the caller, while `current` is what gets persisted.
      result = await action(current);
      return current;
    });
    if (expired) throw createError({ statusCode: 410, statusMessage: 'Sign-in attempt expired' });
    return result;
  });
}

function requireOrigin(event: H3Event, expected: string) {
  if (expected !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, statusMessage: 'Sign-in origin mismatch' });
  }
}

function assertTransactionStatus(transaction: Transaction, expected: Status) {
  if (transaction.status !== expected) {
    throw createError({ statusCode: 409, statusMessage: `Sign-in attempt ${transaction.status}` });
  }
}

export async function createNativeLoginHandoff(event: H3Event, body: unknown) {
  assertNativeLoginHandoffAvailable(event);
  const input = parseZodRequestBody(
    z.strictObject({ challenge: secretSchema, origin: z.string().url() }),
    body,
    'Invalid sign-in request'
  );
  requireOrigin(event, input.origin);
  const id = randomBytes(32).toString('base64url');
  const browserToken = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + LIFETIME_MS;
  await getUserSettingsStorageAdapter<Transaction>(COLLECTION).write(id, {
    origin: input.origin,
    challenge: input.challenge,
    browserHash: hash(browserToken),
    expiresAt,
    status: 'pending',
  });
  const browserUrl = new URL(
    withAppBase('/native-login', useRuntimeConfig(event).app.baseURL),
    input.origin
  );
  browserUrl.search = new URLSearchParams({ id, browserToken }).toString();
  return {
    id,
    browserUrl: browserUrl.href,
    expiresAt,
    interval: 2,
    confirmationCode: id.slice(0, 8).toUpperCase(),
  };
}

export async function readNativeLoginBrowser(event: H3Event, input: unknown) {
  assertNativeLoginHandoffAvailable(event);
  const { id, browserToken } = parseZodRequestBody(
    browserSchema,
    input,
    'Invalid browser sign-in request'
  );
  return update(id, (transaction) => {
    requireOrigin(event, transaction.origin);
    if (!matches(transaction.browserHash, hash(browserToken))) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid browser sign-in proof' });
    }
    return {
      id,
      browserToken,
      status: transaction.status,
      confirmationCode: id.slice(0, 8).toUpperCase(),
    };
  });
}

export async function getNativeLoginSession(event: H3Event) {
  const session = await getUserSession(event);
  if (
    (session.auth_provider !== 'github' && session.auth_provider !== 'pat') ||
    !session.user ||
    !session.secure?.access_token
  ) {
    return null;
  }
  return {
    authProvider: session.auth_provider,
    accessToken: session.secure.access_token,
    user: session.user,
  };
}

export async function approveNativeLoginHandoff(event: H3Event, body: unknown) {
  const browser = await readNativeLoginBrowser(event, body);
  const session = await getNativeLoginSession(event);
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sign in to GitPulse in this browser first',
    });
  }
  const grant = await seal(session);
  return update(browser.id, (transaction) => {
    assertTransactionStatus(transaction, 'pending');
    transaction.status = 'approved';
    transaction.grant = grant;
    return { status: 'approved' };
  });
}

export async function useNativeLoginHandoff(
  event: H3Event,
  input: unknown,
  action: 'status' | 'cancel' | 'redeem'
) {
  assertNativeLoginHandoffAvailable(event);
  const proof = parseZodRequestBody(proofSchema, input, 'Invalid app sign-in proof');
  requireOrigin(event, proof.origin);
  return update(proof.id, async (transaction) => {
    requireOrigin(event, transaction.origin);
    if (
      transaction.origin !== proof.origin ||
      !matches(transaction.challenge, hash(proof.verifier))
    ) {
      throw createError({ statusCode: 403, statusMessage: 'Invalid app sign-in proof' });
    }
    if (action === 'status') return { status: transaction.status };
    if (action === 'cancel') {
      if (transaction.status !== 'cancelled') {
        if (!['pending', 'approved'].includes(transaction.status))
          assertTransactionStatus(transaction, 'pending');
        transaction.status = 'cancelled';
        delete transaction.grant;
      }
      return { status: 'cancelled' };
    }
    assertTransactionStatus(transaction, 'approved');
    const grant = await unseal(transaction.grant!);
    transaction.status = 'redeemed';
    delete transaction.grant;
    return grant;
  });
}
