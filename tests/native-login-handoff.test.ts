import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawn } from 'bun';
import { createError, toWebHandler, useSession } from 'h3';
import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs-lite';

import * as authReturn from '../shared/utils/auth-return-route';
import * as env from '../shared/utils/user-settings-storage-env';
import { createNativeLoginTestHandler } from './fixtures/native-login-server';
mock.module('#shared/utils/user-settings-storage-env', () => env);
mock.module('#shared/utils/auth-return-route', () => authReturn);
const { clearCachedUserSettingsStorageAdapterForTesting } =
  await import('../server/utils/user-settings-storage-utils');

const password = 'native-test-session-password-at-least-32-characters';
const origin = 'https://gitpulse.test';
const verifier = 'a'.repeat(43);
const original = {
  useRuntimeConfig: globalThis.useRuntimeConfig,
  useStorage: globalThis.useStorage,
  getUserSession: globalThis.getUserSession,
  setUserSession: globalThis.setUserSession,
  createError: globalThis.createError,
};
let handle: ReturnType<typeof toWebHandler>;
let directory: string;
const originalBase = process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE;
const originalDriver = process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER;
const originalPassword = process.env.NUXT_SESSION_PASSWORD;

beforeEach(async () => {
  globalThis.createError = createError;
  directory = await mkdtemp(join(tmpdir(), 'gitpulse-native-login-'));
  process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER = 'fs';
  process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE = directory;
  process.env.NUXT_SESSION_PASSWORD = password;
  const storage = createStorage({ driver: fsDriver({ base: directory }) });
  globalThis.useStorage = (() => storage) as typeof useStorage;
  globalThis.useRuntimeConfig = (() => ({
    app: { baseURL: '/' },
    session: { password },
    gitPulseAuth: { personalModeEnabled: false, githubOAuthEnabled: true, tokenEnabled: false },
  })) as typeof useRuntimeConfig;
  globalThis.getUserSession = (async (event) => {
    const session = await useSession(event, { password });
    return { ...session.data, id: session.id };
  }) as typeof getUserSession;
  globalThis.setUserSession = (async (event, data, config) => {
    const session = await useSession(event, { password, ...config });
    await session.update(data);
    return session.data;
  }) as typeof setUserSession;
  clearCachedUserSettingsStorageAdapterForTesting();
  handle = await createNativeLoginTestHandler();
});

afterEach(async () => {
  Object.assign(globalThis, original);
  clearCachedUserSettingsStorageAdapterForTesting();
  if (originalBase === undefined) delete process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE;
  else process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE = originalBase;
  if (originalDriver === undefined) delete process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER;
  else process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER = originalDriver;
  if (originalPassword === undefined) delete process.env.NUXT_SESSION_PASSWORD;
  else process.env.NUXT_SESSION_PASSWORD = originalPassword;
  await rm(directory, { recursive: true, force: true });
});

async function request(
  path: string,
  body?: object,
  cookie = 'gitpulse_csrf=test-csrf',
  headers: Record<string, string> = {},
  backend = origin
) {
  return handle(
    new Request(`${backend}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        cookie,
        host: new URL(backend).host,
        'x-forwarded-proto': new URL(backend).protocol.slice(0, -1),
        ...(body ? { 'content-type': 'application/json', 'x-csrf-token': 'test-csrf' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

async function createAttempt() {
  const response = await request('/auth/native/create', {
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    origin,
  });
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json();
}

test('browser approval lets only the initiating app redeem its own sealed session', async () => {
  const attempt = await createAttempt();
  const url = new URL(attempt.browserUrl);
  expect(url.origin).toBe(origin);
  expect(url.pathname).toBe('/native-login');
  expect(attempt.browserUrl).not.toContain(verifier);
  expect(attempt.browserUrl).not.toContain('github-token');
  const proof = { id: attempt.id, verifier, origin };
  const statusPath = `/auth/native/status?id=${attempt.id}`;
  const proofHeaders = { 'x-native-verifier': verifier, 'x-native-origin': origin };
  const pending = await request(statusPath, undefined, undefined, proofHeaders);
  expect(await pending.json()).toMatchObject({ status: 'pending' });
  expect(pending.headers.getSetCookie().join()).not.toContain('h3=');
  expect((await request('/auth/native/redeem', proof)).status).toBe(409);

  const browserSignIn = await request('/test/oauth-success');
  const browserCookie = browserSignIn.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const browserPage = await request(`${url.pathname}${url.search}`, undefined, browserCookie);
  expect(browserPage.status).toBe(200);
  expect(await browserPage.text()).toContain(attempt.confirmationCode);
  const approved = await request(
    '/auth/native/approve',
    {
      id: attempt.id,
      browserToken: url.searchParams.get('browserToken'),
    },
    `${browserCookie}; gitpulse_csrf=test-csrf`
  );
  expect(approved.status).toBe(200);
  expect(approved.headers.getSetCookie().join()).not.toContain('h3=');
  const status = await request(statusPath, undefined, undefined, proofHeaders);
  expect(await status.json()).toMatchObject({ status: 'approved' });
  expect(status.headers.getSetCookie()).toEqual([]);

  const redeemed = await request('/auth/native/redeem', proof);
  expect(redeemed.status).toBe(200);
  expect(await redeemed.json()).toMatchObject({ user: { login: 'octocat' } });
  const appCookie = redeemed.headers.getSetCookie().join();
  expect(appCookie).toContain('HttpOnly');
  expect(appCookie).not.toContain(browserCookie.split(';')[0]!);
  expect(appCookie).not.toContain('github-token');
  expect((await request('/auth/native/redeem', proof)).status).toBe(409);
});

async function approveAttempt(attempt: Awaited<ReturnType<typeof createAttempt>>) {
  const browser = await request('/test/oauth-success');
  const cookie = browser.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const response = await request(
    '/auth/native/approve',
    {
      id: attempt.id,
      browserToken: new URL(attempt.browserUrl).searchParams.get('browserToken'),
    },
    `${cookie}; gitpulse_csrf=test-csrf`
  );
  expect(response.status).toBe(200);
}

test('rejects wrong verifier, wrong backend origin and forged browser approval without consuming the attempt', async () => {
  const attempt = await createAttempt();
  await approveAttempt(attempt);
  const proof = { id: attempt.id, verifier, origin };
  expect(
    (await request('/auth/native/redeem', { ...proof, verifier: 'b'.repeat(43) })).status
  ).toBe(403);
  expect(
    (await request('/auth/native/redeem', { ...proof, origin: 'https://other.test' })).status
  ).toBe(403);
  expect(
    (await request('/auth/native/redeem', proof, undefined, {}, 'https://other.test')).status
  ).toBe(403);
  expect((await request('/auth/native/redeem', proof)).status).toBe(200);
});

test.each([false, true])(
  'cancellation is idempotent and prevents approval and redemption (approved=%s)',
  async (approved) => {
    const attempt = await createAttempt();
    if (approved) await approveAttempt(attempt);
    const proof = { id: attempt.id, verifier, origin };
    for (let index = 0; index < 2; index++) {
      expect((await request('/auth/native/cancel', proof)).status).toBe(200);
    }
    expect((await request('/auth/native/redeem', proof)).status).toBe(409);
    const browser = await request('/test/oauth-success');
    const cookie = browser.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    expect(
      (
        await request(
          '/auth/native/approve',
          {
            id: attempt.id,
            browserToken: new URL(attempt.browserUrl).searchParams.get('browserToken'),
          },
          `${cookie}; gitpulse_csrf=test-csrf`
        )
      ).status
    ).toBe(409);
    expect(
      (await request(new URL(attempt.browserUrl).pathname + new URL(attempt.browserUrl).search))
        .status
    ).toBe(200);
  }
);

test('an approved attempt expires at the boundary and never establishes an app session', async () => {
  const attempt = await createAttempt();
  await approveAttempt(attempt);
  const clock = spyOn(Date, 'now');
  clock.mockReturnValue(attempt.expiresAt);
  try {
    const response = await request('/auth/native/redeem', { id: attempt.id, verifier, origin });
    expect(response.status).toBe(410);
    expect(response.headers.getSetCookie()).toEqual([]);
  } finally {
    clock.mockRestore();
  }
});

test('simultaneous redemption mints exactly one session, including after adapter recreation', async () => {
  const attempt = await createAttempt();
  await approveAttempt(attempt);
  clearCachedUserSettingsStorageAdapterForTesting();
  const responses = await Promise.all(
    Array.from({ length: 6 }, () =>
      request('/auth/native/redeem', { id: attempt.id, verifier, origin })
    )
  );
  expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
  expect(responses.filter((response) => response.status === 409)).toHaveLength(5);
  expect(responses.filter((response) => response.headers.getSetCookie().length > 0)).toHaveLength(
    1
  );
});

test('all mutations require CSRF and browser approval requires its own GitHub session and browser proof', async () => {
  const attempt = await createAttempt();
  const browserProof = {
    id: attempt.id,
    browserToken: new URL(attempt.browserUrl).searchParams.get('browserToken'),
  };
  for (const action of ['create', 'approve', 'cancel', 'redeem']) {
    expect((await request(`/auth/native/${action}`, {}, '', { 'x-csrf-token': '' })).status).toBe(
      403
    );
  }
  expect((await request('/auth/native/approve', browserProof)).status).toBe(401);
  expect(
    (await request('/auth/native/approve', { ...browserProof, browserToken: 'b'.repeat(43) }))
      .status
  ).toBe(403);
  const hostileOrigin = await request(
    '/auth/native/cancel',
    { id: attempt.id, verifier, origin },
    undefined,
    { origin: 'https://attacker.test' }
  );
  expect(hostileOrigin.status).toBe(403);
  const status = await request(`/auth/native/status?id=${attempt.id}`, undefined, undefined, {
    'x-native-verifier': verifier,
    'x-native-origin': origin,
  });
  expect(await status.json()).toEqual({ status: 'pending' });
});

test('the browser can explicitly approve using a CSRF-protected form and return to the result page', async () => {
  const attempt = await createAttempt();
  const browser = await request('/test/oauth-success');
  const cookie = browser.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const form = new URLSearchParams({
    id: attempt.id,
    browserToken: new URL(attempt.browserUrl).searchParams.get('browserToken')!,
    csrfToken: 'test-csrf',
  });
  const response = await handle(
    new Request(`${origin}/auth/native/approve`, {
      method: 'POST',
      headers: {
        host: 'gitpulse.test',
        'x-forwarded-proto': 'https',
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `${cookie}; gitpulse_csrf=test-csrf`,
        origin,
      },
      body: form,
    })
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(
    new URL(attempt.browserUrl).pathname + new URL(attempt.browserUrl).search
  );
});

test('the approval page keeps a real Origin on its form POST instead of no-referrer', async () => {
  const attempt = await createAttempt();
  const browser = await request('/test/oauth-success');
  const cookie = browser.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const url = new URL(attempt.browserUrl);
  const page = await request(`${url.pathname}${url.search}`, undefined, cookie);
  expect(page.status).toBe(200);
  // A `no-referrer` policy would make the browser serialize this form's Origin
  // as the literal `null`, which the double-submit check rejects.
  expect(page.headers.get('referrer-policy')).toBe('same-origin');

  const form = new URLSearchParams({
    id: attempt.id,
    browserToken: url.searchParams.get('browserToken')!,
    csrfToken: 'test-csrf',
  });
  const formRequest = (originHeader: string) =>
    handle(
      new Request(`${origin}/auth/native/approve`, {
        method: 'POST',
        headers: {
          host: 'gitpulse.test',
          'x-forwarded-proto': 'https',
          'content-type': 'application/x-www-form-urlencoded',
          cookie: `${cookie}; gitpulse_csrf=test-csrf`,
          origin: originHeader,
        },
        body: form,
      })
    );

  expect((await formRequest('null')).status).toBe(403);
  expect((await formRequest(origin)).status).toBe(303);
});

test('two Nitro workers sharing filesystem storage cannot redeem case variants of the same grant twice', async () => {
  const attempt = await createAttempt();
  await approveAttempt(attempt);
  const workers = Array.from({ length: 2 }, () =>
    spawn(
      [
        process.execPath,
        fileURLToPath(new URL('./fixtures/native-login-server.ts', import.meta.url)),
        directory,
      ],
      { stdout: 'pipe', stderr: 'pipe' }
    )
  );
  try {
    const urls = await Promise.all(
      workers.map(async (worker) => {
        const { value } = await worker.stdout.getReader().read();
        return new TextDecoder().decode(value).trim();
      })
    );
    const responses = await Promise.all(
      urls.map((url, index) =>
        fetch(`${url}auth/native/redeem`, {
          method: 'POST',
          headers: {
            host: 'gitpulse.test',
            'x-forwarded-proto': 'https',
            'content-type': 'application/json',
            cookie: 'gitpulse_csrf=test-csrf',
            'x-csrf-token': 'test-csrf',
          },
          body: JSON.stringify({
            id: index === 0 ? attempt.id : attempt.id.toUpperCase(),
            verifier,
            origin,
          }),
        })
      )
    );
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(responses.filter((response) => response.headers.getSetCookie().length > 0)).toHaveLength(
      1
    );
  } finally {
    for (const worker of workers) worker.kill();
    await Promise.all(workers.map((worker) => worker.exited));
  }
}, 15_000);
