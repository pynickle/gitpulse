// A local HTTP fixture for native client contract tests. Only the external
// GitHub success and Nuxt runtime bindings are supplied by this harness.
import { mock } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getCookie,
  setCookie,
  toWebHandler,
  useSession,
} from 'h3';
import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs-lite';

import * as authReturn from '../../shared/utils/auth-return-route';
import * as env from '../../shared/utils/user-settings-storage-env';

mock.module('#shared/utils/auth-return-route', () => authReturn);
mock.module('#shared/utils/user-settings-storage-env', () => env);

export async function createNativeLoginTestHandler(baseURL = '/') {
  const router = createRouter();
  const route = (path: string) => authReturn.withAppBase(path, baseURL);
  router.post(
    route('/auth/native/create'),
    (await import('../../server/routes/auth/native/create.post')).default
  );
  router.get(
    route('/auth/native/status'),
    (await import('../../server/routes/auth/native/status.get')).default
  );
  router.post(
    route('/auth/native/approve'),
    (await import('../../server/routes/auth/native/approve.post')).default
  );
  router.post(
    route('/auth/native/redeem'),
    (await import('../../server/routes/auth/native/redeem.post')).default
  );
  router.post(
    route('/auth/native/cancel'),
    (await import('../../server/routes/auth/native/cancel.post')).default
  );
  router.get(
    route('/native-login'),
    (await import('../../server/routes/native-login.get')).default
  );
  router.get(
    route('/api/native/capabilities'),
    (await import('../../server/api/native/capabilities.get')).default
  );
  router.get(
    route('/api/_auth/session'),
    defineEventHandler(async (event) => {
      const session = await getUserSession(event);
      return session.user ? { user: session.user } : {};
    })
  );
  router.get(
    route('/test/oauth-success'),
    defineEventHandler(async (event) => {
      const { establishGitHubSession } = await import('../../server/utils/auth-session-utils');
      await establishGitHubSession(event, 'github', 'github-token-never-in-urls', {
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://github.test/avatar',
      });
      return { ok: true };
    })
  );
  const app = createApp();
  app.use(
    defineEventHandler((event) => {
      if (!getCookie(event, 'gitpulse_csrf')) {
        event.context.gitpulseCsrfToken = 'fixture-csrf-token';
        setCookie(event, 'gitpulse_csrf', 'fixture-csrf-token', { path: '/', sameSite: 'lax' });
      }
    })
  );
  app.use(router);
  return toWebHandler(app);
}

if (import.meta.main) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Pass an isolated test storage directory');
  process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER = 'fs';
  process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE = directory;
  const password = 'native-test-session-password-at-least-32-characters';
  process.env.NUXT_SESSION_PASSWORD = password;
  const storage = createStorage({ driver: fsDriver({ base: directory }) });
  Object.assign(globalThis, {
    createError,
    useStorage: () => storage,
    useRuntimeConfig: () => ({
      app: { baseURL: '/pulse/' },
      session: { password },
      gitPulseAuth: { personalModeEnabled: false, tokenEnabled: false, githubOAuthEnabled: true },
    }),
    getUserSession: async (event: Parameters<typeof useSession>[0]) => {
      const session = await useSession(event, {
        name: 'nuxt-session',
        password,
        cookie: { secure: false },
      });
      return { ...session.data, id: session.id };
    },
    setUserSession: async (
      event: Parameters<typeof useSession>[0],
      data: Record<string, unknown>,
      config?: { maxAge?: number }
    ) => {
      const session = await useSession(event, {
        name: 'nuxt-session',
        password,
        cookie: { secure: false },
        ...config,
      });
      await session.update(data);
      return session.data;
    },
  });
  const { serve } = await import('bun');
  const server = serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: await createNativeLoginTestHandler('/pulse/'),
  });
  process.stdout.write(`${server.url.origin}/pulse/\n`);
}
