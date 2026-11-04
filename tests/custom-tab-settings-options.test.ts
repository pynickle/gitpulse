import { describe, expect, mock, test } from 'bun:test';

import * as githubSearchQuery from '../shared/utils/github-search-query';

mock.module('#shared/utils/github-search-query', () => githubSearchQuery);

const { customTabEndpointOptions } = await import('../app/composables/useCustomTabSettingsOptions');

describe('custom tab settings options', () => {
  test('exposes all supported GitHub Search endpoints with issues first', () => {
    expect(customTabEndpointOptions.map((option) => option.value)).toEqual([
      'issues',
      'repositories',
    ]);
  });
});
