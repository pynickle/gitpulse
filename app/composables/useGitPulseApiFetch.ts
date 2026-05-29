const CSRF_COOKIE_NAME = 'gitpulse_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const normalizeMethod = (method: unknown) => {
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
};

export function useGitPulseApiFetch() {
  const requestFetch = useRequestFetch();
  const csrfCookie = useCookie<string | null | undefined>(CSRF_COOKIE_NAME, {
    readonly: true,
  });

  return $fetch.create({
    async onRequest({ options }) {
      const method = normalizeMethod(options.method);
      if (SAFE_METHODS.has(method)) {
        return;
      }

      const token = csrfCookie.value;
      if (!token) {
        return;
      }

      const headers = new Headers(options.headers as HeadersInit | undefined);
      headers.set(CSRF_HEADER_NAME, token);
      options.headers = headers;
    },
    fetch: requestFetch,
  });
}
