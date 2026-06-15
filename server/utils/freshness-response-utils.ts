export interface FreshnessResponse {
  signature: string;
  itemCount?: number;
  totalCount?: number;
  latestUpdatedAt?: string | null;
  pollIntervalMs?: number;
}

export const parseGitHubPollIntervalMs = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const seconds = typeof rawValue === 'string' ? Number.parseInt(rawValue, 10) : Number(rawValue);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
};

export const getLatestUpdatedAt = <T extends { updated_at?: unknown; pushed_at?: unknown }>(
  items: T[]
) => {
  const timestamps = items
    .map((item) => item.updated_at ?? item.pushed_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((left, right) => right.localeCompare(left));

  return timestamps[0] ?? null;
};
