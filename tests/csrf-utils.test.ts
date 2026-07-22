import { afterEach, describe, expect, test } from 'bun:test';

import { isSameOriginApiUrl, normalizeMethod, SAFE_METHODS } from '../app/utils/csrf';

const originalLocation = globalThis.location;

afterEach(() => {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: originalLocation,
  });
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
});
