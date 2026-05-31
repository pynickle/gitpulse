import { resolveAuthProviderState } from '../../utils/auth-providers';
import { assertCsrfToken } from '../../utils/csrf-utils';
import { clearRememberDeviceCookie } from '../../utils/personal-mode-utils';

export default defineEventHandler(async (event) => {
  assertCsrfToken(event, '/auth/logout');

  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    clearRememberDeviceCookie(event);
  }

  await clearUserSession(event);

  return {
    ok: true,
  };
});
