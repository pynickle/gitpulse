import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SAFE_METHODS,
  normalizeMethod,
  isSameOriginApiUrl,
} from '~/utils/csrf';

/**
 * Best-effort global CSRF injection for callers that still use `globalThis.$fetch`.
 *
 * Nuxt 4.5 auto-imports `$fetch` from `#build/fetch.mjs` as a module binding, so
 * reassigning `globalThis.$fetch` no longer intercepts auto-imported `$fetch`
 * calls in app code. Mutating same-origin `/api/**` and `/auth/**` requests must
 * go through `useGitPulseApiFetch()` (or pass `X-CSRF-Token` explicitly).
 */
export default defineNuxtPlugin(() => {
  const csrfCookie = useCookie<string | null | undefined>(CSRF_COOKIE_NAME, {
    readonly: true,
  });

  const baseFetch = globalThis.$fetch ?? $fetch;

  globalThis.$fetch = baseFetch.create({
    onRequest({ request, options }) {
      const method = normalizeMethod(options.method);

      if (SAFE_METHODS.has(method)) {
        return;
      }

      if (!isSameOriginApiUrl(request)) {
        return;
      }

      const token = csrfCookie.value;

      if (!token) {
        console.warn(`[csrf] missing client cookie for ${method} ${String(request)}`);
        return;
      }

      const headers = new Headers(options.headers as HeadersInit | undefined);
      headers.set(CSRF_HEADER_NAME, token);
      options.headers = headers;
    },
  });
});
