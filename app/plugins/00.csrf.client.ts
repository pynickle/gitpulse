const CSRF_COOKIE_NAME = 'gitpulse_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeMethod(method: unknown): string {
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
}

function isSameOriginApiUrl(request: unknown): boolean {
  if (typeof request !== 'string') {
    return false;
  }

  if (request.startsWith('/api/')) {
    return true;
  }

  try {
    const parsed = new URL(request, window.location.origin);

    return (
      parsed.origin === window.location.origin &&
      (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/auth/'))
    );
  } catch {
    return false;
  }
}

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
