import { defineEventHandler, readBody } from 'h3';

import {
  establishGitHubSession,
  PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
} from '../../../utils/auth-session-utils';
import { assertCsrfToken } from '../../../utils/csrf-utils';
import { useNativeLoginHandoff } from '../../../utils/native-login-handoff';

export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/native/redeem');
  const grant = await useNativeLoginHandoff(event, await readBody(event), 'redeem');
  if (!('accessToken' in grant)) throw new Error('Missing approved sign-in');
  await establishGitHubSession(event, 'github', grant.accessToken, grant.user, {
    maxAge: PERSISTENT_AUTH_SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true, user: grant.user };
});
