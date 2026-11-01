import * as z from 'zod';

// A grant crosses a trust boundary the first time anyone reads it back: the
// sealed payload is authenticated, but the shape inside it is only as current as
// the code that sealed it. Validate it once here, before it can reach
// `establishGitHubSession()` and become a session cookie.
const grantSchema = z.object({
  // Grants approved before provider preservation contain only OAuth credentials.
  authProvider: z.enum(['github', 'pat']).optional(),
  accessToken: z.string().min(1),
  user: z.object({
    id: z.number().int().optional(),
    login: z.string().min(1),
    // A session written by `establishGitHubSession()` always carries both, but a
    // grant sealed by an older build can still hold GitHub's nulls.
    name: z.string().nullish(),
    avatar_url: z.string().nullish(),
  }),
});

export interface NativeLoginGrant {
  authProvider?: 'github' | 'pat';
  accessToken: string;
  user: { id?: number; login: string; name: string; avatar_url: string };
}

/**
 * Reads the decrypted payload of an approved native login grant.
 *
 * Returns `null` for anything that is not a GitHub credential set for a real
 * user, so a corrupt or foreign payload can never mint a session.
 */
export function parseNativeLoginGrant(serialized: string): NativeLoginGrant | null {
  let payload: unknown;
  try {
    payload = JSON.parse(serialized);
  } catch {
    return null;
  }

  const parsed = grantSchema.safeParse(payload);
  if (!parsed.success) return null;

  const { authProvider, accessToken, user } = parsed.data;
  return {
    ...(authProvider ? { authProvider } : {}),
    accessToken,
    user: {
      ...(user.id === undefined ? {} : { id: user.id }),
      login: user.login,
      name: user.name ?? user.login,
      avatar_url: user.avatar_url ?? '',
    },
  };
}
