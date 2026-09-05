import { describe, expect, test } from 'bun:test';

import { isLaunchRequest, launchGitPulse, LAUNCH_MESSAGE_TYPE } from '../utils/launch';

describe('GitPulse launch message', () => {
  test('accepts only launch messages with optional GitHub URLs', () => {
    expect(isLaunchRequest({ type: LAUNCH_MESSAGE_TYPE })).toBe(true);
    expect(
      isLaunchRequest({ type: LAUNCH_MESSAGE_TYPE, githubUrl: 'https://github.com/owner/repo' })
    ).toBe(true);
    expect(isLaunchRequest({ type: 'other' })).toBe(false);
    expect(isLaunchRequest({ type: LAUNCH_MESSAGE_TYPE, githubUrl: 42 })).toBe(false);
  });

  test('creates a tab only after building a validated open URL', async () => {
    const createdUrls: string[] = [];
    const result = await launchGitPulse(
      {
        type: LAUNCH_MESSAGE_TYPE,
        githubUrl: 'https://github.com/owner/repo/pull/7',
      },
      {
        getBaseUrl: async () => 'https://gitpulse.example.com',
        createTab: async (url) => {
          createdUrls.push(url);
        },
      }
    );

    expect(result).toEqual({ ok: true });
    expect(createdUrls).toEqual([
      'https://gitpulse.example.com/open?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7',
    ]);
  });

  test('rejects non-GitHub URLs before reading settings or creating a tab', async () => {
    let loaded = false;
    let created = false;
    const result = await launchGitPulse(
      {
        type: LAUNCH_MESSAGE_TYPE,
        githubUrl: 'https://evil.example/steal',
      },
      {
        getBaseUrl: async () => {
          loaded = true;
          return 'https://gitpulse.example.com';
        },
        createTab: async () => {
          created = true;
        },
      }
    );

    expect(result).toEqual({
      ok: false,
      error: 'Only HTTPS GitHub pages can be opened in GitPulse.',
    });
    expect(loaded).toBe(false);
    expect(created).toBe(false);
  });
});
