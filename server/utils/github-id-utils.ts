/**
 * GitHub ids arrive as either node-id strings or numeric database ids.
 * A non-finite number is not a usable id, so it maps to `undefined`.
 */
export const stringifyGitHubId = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};
