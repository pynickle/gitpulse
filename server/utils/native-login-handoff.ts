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
import * as z from 'zod';

import { withAppBase } from '#shared/utils/auth-return-route';
import {
  DEFAULT_USER_SETTINGS_FS_BASE,
  normalizeUserSettingsStorageDriver,
} from '#shared/utils/user-settings-storage-env';

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
type Grant = { accessToken: string; user: { login: string; name: string; avatar_url: string } };
interface Transaction {
  origin: string;
  challenge: string;
  browserHash: string;
  expiresAt: number;
  status: Status;
  grant?: string;
}

function sessionPassword() {
  const config = useRuntimeConfig();
  return (
    process.env[`${config.nitro?.envPrefix || 'NUXT_'}SESSION_PASSWORD`] ||
    config.session?.password ||
    ''
  );
}

export function nativeLoginHandoffAvailable() {
  const providers = resolveAuthProviderState();
  return (
    !providers.personalMode &&
    providers.oauthEnabled &&
    ['fs', 'redis', 'upstash'].includes(
      normalizeUserSettingsStorageDriver(process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER)
    ) &&
    typeof sessionPassword() === 'string' &&
    sessionPassword().length >= 32
  );
}

export function assertNativeLoginHandoffAvailable(event: H3Event) {
  setHeader(event, 'Cache-Control', 'no-store');
  // `no-referrer` would make the browser serialize the approval form's Origin
  // as the literal `null`, which the double-submit check rejects. `same-origin`
  // keeps the app sign-in identifiers out of cross-origin referrers (the OAuth
  // link to GitHub sends none) while still sending a real Origin here.
  setHeader(event, 'Referrer-Policy', 'same-origin');
  if (!nativeLoginHandoffAvailable()) {
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

function seal(grant: Grant) {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(`gitpulse-native-handoff:${sessionPassword()}`).digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(grant), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function unseal(value: string): Grant {
  const bytes = Buffer.from(value, 'base64url');
  const key = createHash('sha256').update(`gitpulse-native-handoff:${sessionPassword()}`).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
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

async function update<T>(id: string, action: (transaction: Transaction) => T): Promise<T> {
  return withTransactionLock(id, async () => {
    let result!: T;
    let expired = false;
    await getUserSettingsStorageAdapter<Transaction>(COLLECTION).update(id, (current) => {
      if (!current)
        throw createError({ statusCode: 404, statusMessage: 'Unknown sign-in attempt' });
      if (current.expiresAt <= Date.now()) {
        expired = true;
        return { ...current, status: 'expired', grant: undefined };
      }
      result = action(current);
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
    withAppBase('/native-login', useRuntimeConfig().app.baseURL),
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

export async function approveNativeLoginHandoff(event: H3Event, body: unknown) {
  const browser = await readNativeLoginBrowser(event, body);
  const session = await getUserSession(event);
  if (session.auth_provider !== 'github' || !session.user || !session.secure?.access_token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sign in with GitHub in this browser first',
    });
  }
  const grant = seal({ accessToken: session.secure.access_token, user: session.user });
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
  return update(proof.id, (transaction) => {
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
    const grant = unseal(transaction.grant!);
    transaction.status = 'redeemed';
    delete transaction.grant;
    return grant;
  });
}
