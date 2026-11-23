import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { H3Event } from 'h3';

import type { GitAvailability } from '#shared/types/pulls';
import { normalizeEnvBoolean } from '#shared/utils/env-boolean';

const exec = promisify(execFile);

const PROBE_TIMEOUT_MS = 10_000;

/** Null until the startup probe has answered; resolved once per process. */
let cached: GitAvailability | null = null;

export function resolveGitEnabled(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event) as {
    gitpulse?: { gitEnabled?: string | boolean };
  };

  return normalizeEnvBoolean(runtimeConfig.gitpulse?.gitEnabled, true);
}

/**
 * Runs the one probe. A missing binary is ENOENT; anything else (a denied
 * binary, a timeout) is equally "cannot run Git" here, and is reported as
 * such rather than being allowed to fail the startup plugin.
 */
export async function probeGitAvailable() {
  try {
    await exec('git', ['--version'], {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
    });
    return true;
  } catch (error: unknown) {
    console.warn('GitPulse could not run Git on this server:', error);
    return false;
  }
}

/** Called by the startup plugin, which owns the only probe. */
export function setGitAvailable(available: boolean) {
  cached = available ? { available: true } : { available: false, reason: 'git_missing' };
}

/**
 * Probes once and keeps the answer for the life of the process. A switched-off
 * capability is never cached, because it costs nothing to re-read and it is the
 * configuration, not the machine, that decides it.
 */
export async function resolveGitAvailability(event?: H3Event): Promise<GitAvailability> {
  if (!resolveGitEnabled(event)) {
    return { available: false, reason: 'disabled' };
  }

  if (cached) return cached;

  setGitAvailable(await probeGitAvailable());

  return cached ?? { available: false, reason: 'git_missing' };
}

/** Read-only: answers what the probe found, without ever spawning Git. */
export function readGitAvailability(event?: H3Event): GitAvailability {
  if (!resolveGitEnabled(event)) {
    return { available: false, reason: 'disabled' };
  }

  // A flag switched on at runtime without a probe having run yet can only be
  // answered pessimistically, because this surface must not spawn a process.
  return cached ?? { available: false, reason: 'git_missing' };
}

export function assertGitAvailable(event: H3Event) {
  const availability = readGitAvailability(event);

  if (availability.available) return;

  // A switched-off deployment does not offer the route at all.
  if (availability.reason === 'disabled') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  throw createError({ statusCode: 503, statusMessage: 'This feature requires Git on the server' });
}

export function resetGitAvailabilityForTesting() {
  cached = null;
}
