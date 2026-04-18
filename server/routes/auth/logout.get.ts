import { resolveAuthProviderState } from '../../utils/auth-providers';
import { clearRememberDeviceCookie } from '../../utils/personal-mode-utils';

export default defineEventHandler(async (event) => {
  const providerState = resolveAuthProviderState();

  if (providerState.personalMode) {
    clearRememberDeviceCookie(event);
  }

  await clearUserSession(event);
  return sendRedirect(event, '/');
});
