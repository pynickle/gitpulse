const GITHUB_AVATAR_HOST = 'avatars.githubusercontent.com';
const GITHUB_AVATAR_DENSITY = 2;
const GITHUB_AVATAR_MAX_SIZE = 460;

const toPositiveNumber = (value: number | string | undefined) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;

  const trimmedValue = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmedValue)) return undefined;

  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
};

export const resolveGitHubAvatarDisplaySize = (
  width: number | string | undefined,
  height: number | string | undefined
) => {
  const dimensions = [toPositiveNumber(width), toPositiveNumber(height)].filter(
    (value): value is number => value !== undefined
  );

  return dimensions.length > 0 ? Math.max(...dimensions) : undefined;
};

export const resolveGitHubAvatarRequestSize = (displaySize: number | string | undefined) => {
  const numericSize = toPositiveNumber(displaySize);
  if (numericSize === undefined) return undefined;

  return Math.min(GITHUB_AVATAR_MAX_SIZE, Math.ceil(numericSize * GITHUB_AVATAR_DENSITY));
};

export const createSizedGitHubAvatarUrl = (
  src: string | null | undefined,
  displaySize: number | string | undefined
) => {
  if (!src) return src;

  const requestSize = resolveGitHubAvatarRequestSize(displaySize);
  if (requestSize === undefined) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  if (url.hostname !== GITHUB_AVATAR_HOST) return src;

  const requestSizeValue = String(requestSize);
  if (url.searchParams.get('s') === requestSizeValue) return src;

  url.searchParams.set('s', requestSizeValue);
  return url.toString();
};
