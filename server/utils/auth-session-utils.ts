import type { H3Event } from 'h3';

type GitHubAuthProvider = 'github' | 'pat';

interface GitHubIdentity {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

export async function establishGitHubSession(
  event: H3Event,
  provider: GitHubAuthProvider,
  accessToken: string,
  user: GitHubIdentity
) {
  await setUserSession(event, {
    user: {
      login: user.login,
      name: user.name ?? user.login,
      avatar_url: user.avatar_url ?? '',
    },
    secure: {
      access_token: accessToken,
    },
    logged_in_at: new Date(),
    auth_provider: provider,
  });
}
