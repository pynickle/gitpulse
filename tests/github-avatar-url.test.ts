import { describe, expect, test } from 'bun:test';

import {
  createSizedGitHubAvatarUrl,
  resolveGitHubAvatarDisplaySize,
  resolveGitHubAvatarRequestSize,
} from '../shared/utils/github-avatar-url';

describe('github avatar url helpers', () => {
  test('adds a 2x size parameter to GitHub avatar URLs', () => {
    const url = createSizedGitHubAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4', 32);

    expect(url).toBe('https://avatars.githubusercontent.com/u/1?v=4&s=64');
  });

  test('uses the largest displayed dimension and clamps GitHub request size', () => {
    const displaySize = resolveGitHubAvatarDisplaySize('280', '128');

    expect(displaySize).toBe(280);
    expect(resolveGitHubAvatarRequestSize(displaySize)).toBe(460);
  });

  test('updates existing avatar size while preserving other GitHub parameters', () => {
    const url = createSizedGitHubAvatarUrl(
      'https://avatars.githubusercontent.com/u/1?u=abc&s=460&v=4',
      '24'
    );

    expect(url).toBe('https://avatars.githubusercontent.com/u/1?u=abc&s=48&v=4');
  });

  test('leaves non-GitHub or dimensionless avatar URLs unchanged', () => {
    expect(createSizedGitHubAvatarUrl('https://example.com/avatar.png', 32)).toBe(
      'https://example.com/avatar.png'
    );
    expect(
      createSizedGitHubAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4', '2rem')
    ).toBe('https://avatars.githubusercontent.com/u/1?v=4');
  });
});
