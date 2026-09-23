/**
 * GitHub answers a GraphQL request that partially succeeded with an error whose
 * `data` still carries the fields that did resolve. Batched aliased queries rely
 * on that salvage so one failed target never blanks the rest of the page.
 */
export function getPartialGraphQLData<T>(error: unknown): T | null {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data &&
    typeof error.data === 'object'
  ) {
    return error.data as T;
  }

  return null;
}
