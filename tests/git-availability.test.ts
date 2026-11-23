import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as envBoolean from '../shared/utils/env-boolean';
mock.module('#shared/utils/env-boolean', () => envBoolean);

const gitAvailability = await import('../server/utils/git-availability');

// `createError` is a Nitro global at runtime; a bare `bun test` run supplies it here.
Object.assign(globalThis, { createError: (input: unknown) => Object.assign(new Error(), input) });

const originalPath = process.env.PATH;
const originalRuntimeConfig = globalThis.useRuntimeConfig;

/** The flag lives in runtimeConfig; the probe reads it on every call. */
function setGitEnabled(value: string | boolean | undefined) {
  globalThis.useRuntimeConfig = (() => ({
    gitpulse: value === undefined ? {} : { gitEnabled: value },
  })) as typeof useRuntimeConfig;
}

beforeEach(() => {
  gitAvailability.resetGitAvailabilityForTesting();
  setGitEnabled('true');
});

afterEach(() => {
  process.env.PATH = originalPath;
  globalThis.useRuntimeConfig = originalRuntimeConfig;
  gitAvailability.resetGitAvailabilityForTesting();
});

describe('git availability', () => {
  test('reports the Git on this host as available', async () => {
    const availability = await gitAvailability.resolveGitAvailability();

    expect(availability).toEqual({ available: true });
  });

  test('answers with a reason instead of throwing when the host has no Git', async () => {
    process.env.PATH = join(tmpdir(), 'gitpulse-no-git-on-this-host');

    const availability = await gitAvailability.resolveGitAvailability();

    expect(availability).toEqual({ available: false, reason: 'git_missing' });
  });

  test('spawns Git once and serves the answer from memory afterwards', async () => {
    process.env.PATH = join(tmpdir(), 'gitpulse-no-git-on-this-host');
    await gitAvailability.resolveGitAvailability();

    // A PATH that now resolves Git would change a fresh probe, not the cached one.
    process.env.PATH = originalPath;

    expect(await gitAvailability.resolveGitAvailability()).toEqual({
      available: false,
      reason: 'git_missing',
    });
  });

  test('reports the capability as switched off, and never reaches for Git', async () => {
    setGitEnabled('false');
    process.env.PATH = join(tmpdir(), 'gitpulse-no-git-on-this-host');

    expect(await gitAvailability.resolveGitAvailability()).toEqual({
      available: false,
      reason: 'disabled',
    });
  });

  test('treats only an explicit off as off, so a deployment that never set the flag keeps Git', async () => {
    for (const value of [undefined, '', 'true', 'yes', 'maybe']) {
      gitAvailability.resetGitAvailabilityForTesting();
      setGitEnabled(value);

      expect(await gitAvailability.resolveGitAvailability()).toEqual({ available: true });
    }
  });
  test('deduplicates concurrent probes on cold start', async () => {
    const [first, second] = await Promise.all([
      gitAvailability.resolveGitAvailability(),
      gitAvailability.resolveGitAvailability(),
    ]);

    expect(first).toEqual({ available: true });
    expect(second).toEqual({ available: true });
  });

  test('requires Git 2.40 or newer for stack rebase plumbing', () => {
    expect(
      gitAvailability.isSupportedGitVersion(gitAvailability.parseGitVersion('git version 2.39.5'))
    ).toBe(false);
    expect(
      gitAvailability.isSupportedGitVersion(gitAvailability.parseGitVersion('git version 2.40.0'))
    ).toBe(true);
    expect(
      gitAvailability.isSupportedGitVersion(gitAvailability.parseGitVersion('git version 2.47.3'))
    ).toBe(true);
    expect(
      gitAvailability.isSupportedGitVersion(
        gitAvailability.parseGitVersion('git version 2.56.0.windows.3')
      )
    ).toBe(true);
    expect(gitAvailability.isSupportedGitVersion(null)).toBe(false);
  });

  test('detects the git replay strategy from help output', () => {
    expect(
      gitAvailability.detectGitReplayModeFromHelp(
        'usage: git replay [--onto=<newbase>] [--ref-action=<mode>] <revision-range>'
      )
    ).toBe('replay-print');
    expect(
      gitAvailability.detectGitReplayModeFromHelp(
        'usage: (EXPERIMENTAL!) git replay --onto=<newbase> <revision-range>'
      )
    ).toBe('replay-legacy');
    expect(gitAvailability.detectGitReplayModeFromHelp("git: 'replay' is not a git command.")).toBe(
      'per-patch'
    );
  });
});

describe('the route gate', () => {
  const event = {} as never;

  test('answers not found on a deployment that switched the capability off', async () => {
    setGitEnabled('false');

    await expect(gitAvailability.assertGitAvailable(event)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    );
  });

  test('answers that Git is required when the capability is on but the host has none', async () => {
    gitAvailability.setGitAvailable(false);

    await expect(gitAvailability.assertGitAvailable(event)).rejects.toThrow(
      expect.objectContaining({ statusCode: 503 })
    );
  });

  test('lets the request through on a host that has Git', async () => {
    gitAvailability.setGitAvailable(true);

    await expect(gitAvailability.assertGitAvailable(event)).resolves.toBeUndefined();
  });
});
