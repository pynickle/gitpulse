type FreshnessPrimitive = string | number | boolean | null;
type FreshnessValue = FreshnessPrimitive | FreshnessValue[] | { [key: string]: FreshnessValue };

export interface FreshnessMarkerInput {
  id?: unknown;
  node_id?: unknown;
  number?: unknown;
  name?: unknown;
  full_name?: unknown;
  state?: unknown;
  updated_at?: unknown;
  pushed_at?: unknown;
  published_at?: unknown;
  created_at?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
  sha?: unknown;
}

const normalizeSignatureValue = (value: unknown): FreshnessValue => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSignatureValue(entry));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeSignatureValue(entry)])
    );
  }

  return String(value);
};

export const createFreshnessSignature = (value: unknown) => {
  return JSON.stringify(normalizeSignatureValue(value));
};

export const createFreshnessItemMarker = (item: FreshnessMarkerInput) => {
  return {
    id: item.id ?? item.node_id ?? item.full_name ?? item.name ?? item.number ?? null,
    state: item.state ?? null,
    sha: item.sha ?? null,
    updated:
      item.updated_at ??
      item.updatedAt ??
      item.pushed_at ??
      item.published_at ??
      item.created_at ??
      item.createdAt ??
      null,
  };
};

export const createCollectionFreshnessSignature = (
  items: FreshnessMarkerInput[],
  meta: Record<string, unknown> = {}
) => {
  return createFreshnessSignature({
    ...meta,
    items: items.map((item) => createFreshnessItemMarker(item)),
  });
};
