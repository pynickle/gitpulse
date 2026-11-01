import { describe, expect, test } from 'bun:test';

import { parseNativeLoginGrant } from '../server/utils/native-login-grant-utils';

const grant = {
  authProvider: 'pat',
  accessToken: 'github-token',
  user: { id: 42, login: 'octocat', name: 'The Octocat', avatar_url: 'https://a.test/u.png' },
};

const seal = (value: unknown) => JSON.stringify(value);

describe('native login grant payload', () => {
  test('reads the credentials and user a session can be built from', () => {
    expect(parseNativeLoginGrant(seal(grant))).toEqual(grant);
  });

  test('accepts a grant approved before providers were preserved', () => {
    const { authProvider: _authProvider, ...legacy } = grant;

    expect(parseNativeLoginGrant(seal(legacy))).toEqual(legacy);
  });

  test('fills the user fields a GitHub session always normalises', () => {
    expect(
      parseNativeLoginGrant(
        seal({ accessToken: 'github-token', user: { login: 'octocat', name: null } })
      )
    ).toEqual({
      accessToken: 'github-token',
      user: { login: 'octocat', name: 'octocat', avatar_url: '' },
    });
  });

  test.each([
    ['not JSON', 'not-json'],
    ['an empty payload', ''],
    ['a JSON scalar', '42'],
    ['a JSON null', 'null'],
    ['an array', '[]'],
    ['a missing access token', seal({ user: grant.user })],
    ['an empty access token', seal({ ...grant, accessToken: '' })],
    ['a non-string access token', seal({ ...grant, accessToken: 42 })],
    ['a missing user', seal({ ...grant, user: undefined })],
    ['a user without a login', seal({ ...grant, user: { name: 'The Octocat' } })],
    ['an empty login', seal({ ...grant, user: { ...grant.user, login: '' } })],
    ['an unknown provider', seal({ ...grant, authProvider: 'oauth' })],
  ])('rejects %s', (_label, payload) => {
    expect(parseNativeLoginGrant(payload)).toBeNull();
  });
});
