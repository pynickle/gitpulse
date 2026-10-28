import { resolveAuthProviderState } from '../utils/auth-providers';
import { assertPersonalCookieSecretStrength } from '../utils/personal-mode-utils';

export default defineNitroPlugin(() => {
  if (import.meta.prerender) {
    return;
  }

  if (
    process.env.AUTH_PERSONAL_TOKEN ||
    process.env.AUTH_PERSONAL_PASSWORD ||
    process.env.AUTH_PERSONAL_COOKIE_SECRET
  ) {
    console.warn(
      '[auth] BREAKING: AUTH_PERSONAL_TOKEN/PASSWORD/COOKIE_SECRET are no longer read. Rename to NUXT_GITPULSE_AUTH_GITHUB_TOKEN, NUXT_GITPULSE_AUTH_PERSONAL_PASSWORD, and NUXT_GITPULSE_AUTH_PERSONAL_COOKIE_SECRET. See CHANGELOG.'
    );
  }

  const providerState = resolveAuthProviderState();

  if (!providerState.personalMode) {
    return;
  }

  assertPersonalCookieSecretStrength();
});
