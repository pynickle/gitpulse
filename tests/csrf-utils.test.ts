import { afterEach, describe, expect, mock, test } from 'bun:test';

import {
  CSRF_HEADER_NAME,
  isSameOriginApiUrl,
  normalizeMethod,
  SAFE_METHODS,
  withCsrfHeader,
} from '../app/utils/csrf';
import * as csrfUtils from '../app/utils/csrf';

mock.module('~/utils/csrf', () => csrfUtils);

type CapturedFetch = {
  request: unknown;
  headers: Record<string, string> | undefined;
};

const captured: CapturedFetch[] = [];
let csrfCookie: string | null = 'token-a';

(
  globalThis as unknown as {
    useRequestFetch: () => (
      request: unknown,
      options?: { headers?: Record<string, string> }
    ) => Promise<unknown>;
    useCookie: () => { value: string | null };
  }
).useRequestFetch = () => async (request, options) => {
  captured.push({ request, headers: options?.headers });
  return {};
};
(
  globalThis as unknown as {
    useCookie: () => { value: string | null };
  }
).useCookie = () => ({ value: csrfCookie });

const { useGitPulseApiFetch } = await import('../app/composables/useGitPulseApiFetch');

const originalLocation = globalThis.location;

afterEach(() => {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: originalLocation,
  });
  captured.length = 0;
  csrfCookie = 'token-a';
});

function setLocationOrigin(origin: string) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin },
  });
}

describe('csrf utils', () => {
  test('normalizeMethod uppercases string methods and defaults unknowns to GET', () => {
    expect(normalizeMethod('post')).toBe('POST');
    expect(normalizeMethod('DELETE')).toBe('DELETE');
    expect(normalizeMethod(undefined)).toBe('GET');
    expect(normalizeMethod(42)).toBe('GET');
  });

  test('SAFE_METHODS covers read-only verbs', () => {
    expect(SAFE_METHODS.has('GET')).toBe(true);
    expect(SAFE_METHODS.has('HEAD')).toBe(true);
    expect(SAFE_METHODS.has('OPTIONS')).toBe(true);
    expect(SAFE_METHODS.has('POST')).toBe(false);
  });

  test('isSameOriginApiUrl accepts relative /api and /auth paths', () => {
    expect(isSameOriginApiUrl('/api/settings')).toBe(true);
    expect(isSameOriginApiUrl('/auth/unlock')).toBe(true);
    expect(isSameOriginApiUrl('/auth/logout')).toBe(true);
    expect(isSameOriginApiUrl('/auth/pat')).toBe(true);
    expect(isSameOriginApiUrl('/dashboard')).toBe(false);
    expect(isSameOriginApiUrl(null)).toBe(false);
  });

  test('isSameOriginApiUrl accepts absolute same-origin API and auth URLs only', () => {
    setLocationOrigin('http://localhost:3000');

    expect(isSameOriginApiUrl('http://localhost:3000/api/settings')).toBe(true);
    expect(isSameOriginApiUrl('http://localhost:3000/auth/unlock')).toBe(true);
    expect(isSameOriginApiUrl('https://evil.example/api/settings')).toBe(false);
    expect(isSameOriginApiUrl('https://evil.example/auth/unlock')).toBe(false);
  });

  test('withCsrfHeader keeps the token when headers are copied by object spread', () => {
    const merged = withCsrfHeader(
      new Headers({ accept: 'application/json', 'x-csrf-token': 'stale' }),
      'token-a'
    );
    const forwarded = {
      cookie: 'gitpulse_csrf=token-a',
      ...merged,
    };

    expect(forwarded.cookie).toBe('gitpulse_csrf=token-a');
    expect(forwarded.accept).toBe('application/json');
    expect(forwarded[CSRF_HEADER_NAME]).toBe('token-a');
    expect(Object.keys(merged).filter((key) => key.toLowerCase() === 'x-csrf-token')).toEqual([
      CSRF_HEADER_NAME,
    ]);
  });

  test('withCsrfHeader copies tuple and plain headers', () => {
    expect(
      withCsrfHeader(
        [
          ['accept', 'application/json'],
          ['X-CSRF-Token', 'stale'],
        ],
        'token-b'
      )
    ).toEqual({
      accept: 'application/json',
      [CSRF_HEADER_NAME]: 'token-b',
    });
    expect(withCsrfHeader({ accept: 'application/json' }, 'token-c')).toEqual({
      accept: 'application/json',
      [CSRF_HEADER_NAME]: 'token-c',
    });
    expect(withCsrfHeader(undefined, 'token-d')).toEqual({
      [CSRF_HEADER_NAME]: 'token-d',
    });
  });

  test('mutating same-origin fetches send the spreadable csrf header', async () => {
    const fetch = useGitPulseApiFetch();

    await fetch('/api/release-timeline/refresh?timeZone=UTC', {
      method: 'POST',
      headers: new Headers({ accept: 'application/json', 'x-csrf-token': 'stale' }),
    });

    const headers = captured[0]?.headers;
    const forwarded = {
      cookie: 'gitpulse_csrf=token-a',
      ...headers,
    };

    expect(captured[0]?.request).toBe('/api/release-timeline/refresh?timeZone=UTC');
    expect(forwarded.cookie).toBe('gitpulse_csrf=token-a');
    expect(forwarded.accept).toBe('application/json');
    expect(forwarded[CSRF_HEADER_NAME]).toBe('token-a');
  });

  test('safe and cross-origin fetches leave headers untouched', async () => {
    const fetch = useGitPulseApiFetch();
    const headers = { accept: 'application/json' };

    await fetch('/api/release-timeline', { headers });
    await fetch('https://example.test/api/release-timeline/refresh', {
      method: 'POST',
      headers,
    });

    expect(captured.map((call) => call.headers)).toEqual([headers, headers]);
  });

  test('a missing csrf cookie still sends the mutating request without a token header', async () => {
    csrfCookie = null;
    const fetch = useGitPulseApiFetch();
    const headers = { accept: 'application/json' };

    await fetch('/api/release-timeline/refresh', { method: 'POST', headers });

    expect(captured[0]?.headers).toEqual(headers);
  });
});
