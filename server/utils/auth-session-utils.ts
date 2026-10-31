import type { LegacyH3Event, RequestEvent } from '#auth-utils';

type GitHubAuthProvider = 'github' | 'pat';

/**
 * The session utils accept both the portable `nuxt/server` event and the h3
 * event a Nuxt 4 route handler receives, so auth routes can stay on either.
 *
 * `LegacyH3Event` is deprecated upstream (`@deprecated Use `defineEventHandler`
 * from `nuxt/server`. Removed with Nuxt 5 support.`), so it must not spread
 * past this alias: new call sites should pass a `RequestEvent`.
 */
type SessionWriteEvent = RequestEvent | LegacyH3Event;

export const PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface GitHubIdentity {
  id?: number | bigint;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

export async function establishGitHubSession(
  event: SessionWriteEvent,
  provider: GitHubAuthProvider,
  accessToken: string,
  user: GitHubIdentity,
  options: { maxAge?: number } = {}
) {
  await setUserSession(
    event,
    {
      user: {
        ...(user.id === undefined ? {} : { id: Number(user.id) }),
        login: user.login,
        name: user.name ?? user.login,
        avatar_url: user.avatar_url ?? '',
      },
      secure: {
        access_token: accessToken,
      },
      logged_in_at: new Date(),
      auth_provider: provider,
    },
    options.maxAge ? { maxAge: options.maxAge } : undefined
  );
}
