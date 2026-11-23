/**
 * Every `NUXT_*` boolean flag is read through this one normalizer, so a
 * deployment that writes `=yes` means the same thing on the server as it does
 * in the docs. A value the set does not recognize keeps the flag's default
 * rather than flipping it.
 */

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

export function normalizeEnvBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;

  return defaultValue;
}
