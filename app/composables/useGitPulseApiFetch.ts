import type { FetchOptions, FetchRequest, ResponseType } from 'ofetch';

import {
  CSRF_COOKIE_NAME,
  SAFE_METHODS,
  normalizeMethod,
  isSameOriginApiUrl,
  withCsrfHeader,
} from '~/utils/csrf';

export function useGitPulseApiFetch() {
  const requestFetch = useRequestFetch();
  const apiFetch = requestFetch as <T = unknown, R extends ResponseType = 'json'>(
    request: FetchRequest,
    options?: FetchOptions<R>
  ) => Promise<T>;
  const csrfCookie = useCookie<string | null | undefined>(CSRF_COOKIE_NAME, {
    readonly: true,
  });

  return <T = unknown, R extends ResponseType = 'json'>(
    request: FetchRequest,
    options: FetchOptions<R> = {}
  ) => {
    const method = normalizeMethod(options.method);
    if (SAFE_METHODS.has(method)) {
      return apiFetch<T, R>(request, options);
    }

    if (!isSameOriginApiUrl(request)) {
      return apiFetch<T, R>(request, options);
    }

    const token = csrfCookie.value;
    if (!token) {
      console.warn(`[csrf] missing client cookie for ${method} ${String(request)}`);
      return apiFetch<T, R>(request, options);
    }

    return apiFetch<T, R>(request, {
      ...options,
      headers: withCsrfHeader(options.headers, token),
    });
  };
}
