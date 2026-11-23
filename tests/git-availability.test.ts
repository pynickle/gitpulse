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
});

describe('the route gate', () => {
  const event = {} as never;

  test('answers not found on a deployment that switched the capability off', () => {
    setGitEnabled('false');

    expect(() => gitAvailability.assertGitAvailable(event)).toThrow(
      expect.objectContaining({ statusCode: 404 })
    );
  });

  test('answers that Git is required when the capability is on but the host has none', () => {
    gitAvailability.setGitAvailable(false);

    expect(() => gitAvailability.assertGitAvailable(event)).toThrow(
      expect.objectContaining({ statusCode: 503 })
    );
  });

  test('lets the request through on a host that has Git', () => {
    gitAvailability.setGitAvailable(true);

    expect(() => gitAvailability.assertGitAvailable(event)).not.toThrow();
  });
});
