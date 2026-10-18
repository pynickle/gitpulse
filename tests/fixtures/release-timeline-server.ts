// A local HTTP fixture for native client contract tests. Only the external
// GitHub reads and Nuxt runtime bindings are supplied by this harness, so the
// app still exercises the real timeline routes, account settings storage, and
// the shared refresh baseline.
import { mock } from 'bun:test';

import {
  createApp,
  createError,
  createRouter,
  defineEventHandler,
  getCookie,
  getRequestHeader,
  readBody,
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

type FixtureRepository = { id: string; owner: string; name: string };
type FixturePage = Record<string, unknown>;

const scenario = {
  pages: {} as Record<string, FixturePage>,
};

// Only the GitHub reads are replaced: paging status, per-repository
// classification, timeline assembly, and the baseline stay the real code.
const graphqlUtils = await import('../../server/utils/release-timeline-graphql-utils');
mock.module('../../server/utils/release-timeline-graphql-utils', () => ({
  ...graphqlUtils,
  fetchFollowedRepositoryReleaseLookups: async (
    _octokit: unknown,
    follows: FixtureRepository[]
  ): Promise<Record<string, FixturePage>> =>
    Object.fromEntries(
      follows.map((follow) => [follow.id, scenario.pages[follow.id] ?? { status: 'transient' }])
    ),
}));

export async function createReleaseTimelineTestHandler(baseURL = '/') {
  const router = createRouter();
  const route = (path: string) => authReturn.withAppBase(path, baseURL);
  router.get(
    route('/api/native/capabilities'),
    (await import('../../server/api/native/capabilities.get')).default
  );
  // The real settings handler depends on Nuxt auto-imports, so read through the
  // same helpers explicitly.
  router.get(
    route('/api/settings'),
    defineEventHandler(async (event) => {
      const { getUserSettingsLogin, readUserSettings } =
        await import('../../server/utils/user-settings-utils');
      return readUserSettings(await getUserSettingsLogin(event));
    })
  );
  router.post(
    route('/api/release-timeline/refresh'),
    (await import('../../server/api/release-timeline/refresh.post')).default
  );
  router.get(
    route('/api/release-timeline'),
    (await import('../../server/api/release-timeline.get')).default
  );
  router.post(
    route('/auth/logout'),
    (await import('../../server/routes/auth/logout.post')).default
  );
  router.get(
    route('/api/_auth/session'),
    defineEventHandler(async (event) => {
      const session = await getUserSession(event);
      return session.user ? { user: session.user } : {};
    })
  );
  router.post(
    route('/test/sign-in'),
    defineEventHandler(async (event) => {
      const body = (await readBody(event).catch(() => null)) as { login?: string } | null;
      const login = body?.login ?? 'octocat';
      const { establishGitHubSession } = await import('../../server/utils/auth-session-utils');
      await establishGitHubSession(event, 'personal', 'fixture-server-token', {
        login,
        name: login === 'hubot' ? 'Hubot' : 'The Octocat',
        avatar_url: 'https://github.test/avatar',
      });
      return { ok: true, login };
    })
  );
  router.post(
    route('/test/scenario'),
    defineEventHandler(async (event) => {
      const { getUserSettingsLogin, patchUserSettings } =
        await import('../../server/utils/user-settings-utils');
      const login = await getUserSettingsLogin(event);
      const body = (await readBody(event)) as {
        follows?: FixtureRepository[];
        pages?: Record<string, FixturePage>;
      };
      scenario.pages = body.pages ?? {};
      if (body.follows) await patchUserSettings(login, { followedRepositories: body.follows });
      return { ok: true };
    })
  );
  router.get(
    route('/test/baseline'),
    defineEventHandler(async (event) => {
      const { getUserSettingsLogin } = await import('../../server/utils/user-settings-utils');
      const { createTimelineHistoryService } =
        await import('../../server/utils/timeline-history-utils');
      const login = await getUserSettingsLogin(event);
      const history = await createTimelineHistoryService().read(login);
      return { baseline: history.baseline };
    })
  );
  router.post(
    route('/test/seed-baseline'),
    defineEventHandler(async (event) => {
      const { getUserSettingsLogin } = await import('../../server/utils/user-settings-utils');
      const { createTimelineHistoryService } =
        await import('../../server/utils/timeline-history-utils');
      const login = await getUserSettingsLogin(event);
      const body = (await readBody(event)) as { baseline: string };
      await createTimelineHistoryService().advanceBaseline(login, body.baseline);
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
      // Mutating web API calls carry the double-submit token, as the app does.
      if (
        event.method !== 'GET' &&
        event.path.includes('/api/') &&
        getRequestHeader(event, 'x-csrf-token') !== getCookie(event, 'gitpulse_csrf')
      ) {
        event.node.res.statusCode = 403;
        return { statusCode: 403, statusMessage: 'csrf_mismatch' };
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
  const password = 'release-timeline-test-session-password-32-characters';
  process.env.NUXT_SESSION_PASSWORD = password;
  const storage = createStorage({ driver: fsDriver({ base: directory }) });
  Object.assign(globalThis, {
    createError,
    defineEventHandler,
    useStorage: () => storage,
    useRuntimeConfig: () => ({
      app: { baseURL: '/pulse/' },
      session: { password },
      gitPulseAuth: {
        personalModeEnabled: true,
        tokenEnabled: false,
        githubOAuthEnabled: false,
        githubToken: 'fixture-server-token',
        personalPassword: 'fixture-personal-password',
        personalCookieSecret: 'fixture-personal-cookie-secret-at-least-32-characters',
      },
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
    fetch: await createReleaseTimelineTestHandler('/pulse/'),
  });
  process.stdout.write(`${server.url.origin}/pulse/\n`);
}
