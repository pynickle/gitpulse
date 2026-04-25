import { resolveAuthProviderState } from '../utils/auth-providers';
import { assertPersonalCookieSecretStrength } from '../utils/personal-mode-utils';

export default defineNitroPlugin(() => {
  if (import.meta.prerender) {
    return;
  }

  if (
    process.env.AUTH_PERSONAL_PAT ||
    process.env.AUTH_PERSONAL_PASSWORD ||
    process.env.AUTH_PERSONAL_COOKIE_SECRET
  ) {
    console.warn(
      '[auth] BREAKING: AUTH_PERSONAL_PAT/PASSWORD/COOKIE_SECRET are no longer read. Rename to NUXT_GIT_PULSE_AUTH_PERSONAL_PAT/PASSWORD/COOKIE_SECRET. See CHANGELOG.'
    );
  }

  const providerState = resolveAuthProviderState();

  if (!providerState.personalMode) {
    return;
  }

  assertPersonalCookieSecretStrength();
});
