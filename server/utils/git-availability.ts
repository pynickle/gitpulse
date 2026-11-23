import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { H3Event } from 'h3';

import type { GitAvailability } from '#shared/types/pulls';
import { normalizeEnvBoolean } from '#shared/utils/env-boolean';

const exec = promisify(execFile);

const PROBE_TIMEOUT_MS = 10_000;

export type GitReplayMode = 'replay-print' | 'replay-legacy' | 'per-patch';

export interface GitVersion {
  major: number;
  minor: number;
  patch: number;
}

interface CachedGitCapabilities {
  availability: GitAvailability;
  replayMode: GitReplayMode;
}

/** Null until the startup probe has answered; resolved once per process. */
let cached: CachedGitCapabilities | null = null;
let inFlight: Promise<CachedGitCapabilities> | null = null;

export function resolveGitEnabled(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event) as {
    gitpulse?: { gitEnabled?: string | boolean };
  };

  return normalizeEnvBoolean(runtimeConfig.gitpulse?.gitEnabled, true);
}

export function parseGitVersion(output: string): GitVersion | null {
  const match = /git version (\d+)\.(\d+)(?:\.(\d+))?/i.exec(output);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3] ?? '0');
  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return null;
  }
  return { major, minor, patch };
}

/** `git merge-tree --write-tree --merge-base` requires Git 2.40 or newer. */
export function isSupportedGitVersion(version: GitVersion | null): boolean {
  if (!version) return false;
  return version.major > 2 || (version.major === 2 && version.minor >= 40);
}

export function detectGitReplayModeFromHelp(helpText: string): GitReplayMode {
  if (/--ref-action\b/.test(helpText) && /--onto\b/.test(helpText)) {
    return 'replay-print';
  }
  if (/\bgit replay\b/.test(helpText) && /--onto\b/.test(helpText)) {
    return 'replay-legacy';
  }
  return 'per-patch';
}

function readOutputText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as { stdout?: unknown; stderr?: unknown };
  const stdout =
    typeof record.stdout === 'string' || Buffer.isBuffer(record.stdout)
      ? String(record.stdout)
      : '';
  const stderr =
    typeof record.stderr === 'string' || Buffer.isBuffer(record.stderr)
      ? String(record.stderr)
      : '';
  return [stdout, stderr].filter(Boolean).join('\n');
}

async function probeGitReplayMode(): Promise<GitReplayMode> {
  try {
    const result = await exec('git', ['replay', '-h'], {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
    });
    return detectGitReplayModeFromHelp(readOutputText(result));
  } catch (error: unknown) {
    // Older Git builds exit 129 for `-h` while still printing usage text to stderr/stdout.
    return detectGitReplayModeFromHelp(readOutputText(error));
  }
}

/**
 * Runs the startup capability probe once. A missing binary (ENOENT), an older
 * Git below 2.40, or a failure/timeout is reported as `git_missing` rather than
 * allowing the startup plugin to fail.
 */
async function probeGitCapabilities(): Promise<CachedGitCapabilities> {
  try {
    const result = await exec('git', ['--version'], {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
    });
    const versionText = readOutputText(result);
    const version = parseGitVersion(versionText);
    if (!isSupportedGitVersion(version)) {
      console.warn(
        `GitPulse Stack Rebase requires Git 2.40 or newer; found "${versionText.trim() || 'unknown'}".`
      );
      return { availability: { available: false, reason: 'git_missing' }, replayMode: 'per-patch' };
    }

    const replayMode = await probeGitReplayMode();
    return { availability: { available: true }, replayMode };
  } catch (error: unknown) {
    console.warn('GitPulse could not run Git on this server:', error);
    return { availability: { available: false, reason: 'git_missing' }, replayMode: 'per-patch' };
  }
}

export async function probeGitAvailable() {
  const result = await probeGitCapabilities();
  return result.availability.available;
}

/** Called by the startup plugin or tests to seed cached capability state. */
export function setGitAvailable(available: boolean, replayMode: GitReplayMode = 'per-patch') {
  cached = {
    availability: available ? { available: true } : { available: false, reason: 'git_missing' },
    replayMode,
  };
}

async function getOrProbeCapabilities(): Promise<CachedGitCapabilities> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = probeGitCapabilities()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Probes once and keeps the answer for the life of the process. Concurrent cold-start
 * callers await the same in-flight probe; a switched-off capability is never cached.
 */
export async function resolveGitAvailability(event?: H3Event): Promise<GitAvailability> {
  if (!resolveGitEnabled(event)) {
    return { available: false, reason: 'disabled' };
  }

  return (await getOrProbeCapabilities()).availability;
}

export async function resolveGitReplayMode(event?: H3Event): Promise<GitReplayMode> {
  if (!resolveGitEnabled(event)) {
    return 'per-patch';
  }

  const capabilities = await getOrProbeCapabilities();
  return capabilities.availability.available ? capabilities.replayMode : 'per-patch';
}

/** Read-only: answers what the probe found, without ever spawning Git. */
export function readGitAvailability(event?: H3Event): GitAvailability {
  if (!resolveGitEnabled(event)) {
    return { available: false, reason: 'disabled' };
  }

  return cached?.availability ?? { available: false, reason: 'git_missing' };
}

export async function assertGitAvailable(event: H3Event) {
  const availability = await resolveGitAvailability(event);

  if (availability.available) return;

  // A switched-off deployment does not offer the route at all.
  if (availability.reason === 'disabled') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  throw createError({ statusCode: 503, statusMessage: 'This feature requires Git on the server' });
}

export function resetGitAvailabilityForTesting() {
  cached = null;
  inFlight = null;
}
