export function getFetchErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const data = 'data' in error ? error.data : undefined;
  const statusMessage =
    data && typeof data === 'object' && 'statusMessage' in data ? data.statusMessage : undefined;

  if (typeof statusMessage === 'string' && statusMessage) {
    return statusMessage;
  }

  const message = 'message' in error ? error.message : undefined;
  return typeof message === 'string' && message ? message : fallback;
}
