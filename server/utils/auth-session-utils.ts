import type { H3Event } from 'h3';

type GitHubAuthProvider = 'github' | 'pat';

export const PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface GitHubIdentity {
  id?: number | bigint;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

export async function establishGitHubSession(
  event: H3Event,
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
