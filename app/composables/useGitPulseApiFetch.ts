import type { FetchOptions, FetchRequest, ResponseType } from 'ofetch';

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  SAFE_METHODS,
  normalizeMethod,
  isSameOriginApiUrl,
} from '~/utils/csrf';

export function useGitPulseApiFetch() {
  const requestFetch = useRequestFetch();
  const csrfCookie = useCookie<string | null | undefined>(CSRF_COOKIE_NAME, {
    readonly: true,
  });

  return <T = unknown, R extends ResponseType = 'json'>(
    request: FetchRequest,
    options: FetchOptions<R> = {}
  ) => {
    const method = normalizeMethod(options.method);
    if (SAFE_METHODS.has(method)) {
      return requestFetch<T, R>(request, options);
    }

    if (!isSameOriginApiUrl(request)) {
      return requestFetch<T, R>(request, options);
    }

    const token = csrfCookie.value;
    if (!token) {
      console.warn(`[csrf] missing client cookie for ${method} ${String(request)}`);
      return requestFetch<T, R>(request, options);
    }

    const headers = new Headers(options.headers as HeadersInit | undefined);
    headers.set(CSRF_HEADER_NAME, token);

    return requestFetch<T, R>(request, {
      ...options,
      headers,
    });
  };
}
