export const MIN_APP_SECRET_LENGTH = 32;

/**
 * nuxt-auth-utils seals the session with a secret derived from Nuxt's
 * `appSecret` (`NUXT_APP_SECRET`), and `deriveSecret` throws a 500 on every
 * session read when it is unset or too short. Nuxt generates one in development
 * only, so a production build with no secret would fail at request time instead
 * of at startup. Fail fast where the other startup validators run, and warn in
 * development where Nuxt fills the gap.
 */
export function assertAppSecretStrength(appSecret: unknown): void {
  const value = typeof appSecret === 'string' ? appSecret : '';
  const message = `[auth] NUXT_APP_SECRET must be at least ${MIN_APP_SECRET_LENGTH} characters (got ${value.length}). Generate one with \`openssl rand -base64 32\`.`;

  if (value.length >= MIN_APP_SECRET_LENGTH) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }

  console.warn(message);
}
