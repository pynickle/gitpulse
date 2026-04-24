import { randomBytes } from 'node:crypto';

import { getCookie, setCookie } from 'h3';

const CSRF_COOKIE_NAME = 'gitpulse_csrf';
const CSRF_TOKEN_BYTES = 32;

function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url');
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (event.method !== 'GET' && event.method !== 'HEAD') {
      return;
    }

    const existing = getCookie(event, CSRF_COOKIE_NAME);

    if (existing) {
      return;
    }

    setCookie(event, CSRF_COOKIE_NAME, generateCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  });
});
