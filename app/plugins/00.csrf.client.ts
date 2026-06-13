import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SAFE_METHODS,
  normalizeMethod,
  isSameOriginApiUrl,
} from '~/utils/csrf';

export default defineNuxtPlugin(() => {
  const csrfCookie = useCookie<string | null | undefined>(CSRF_COOKIE_NAME, {
    readonly: true,
  });

  (globalThis as unknown as { $fetch: typeof $fetch }).$fetch = $fetch.create({
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
