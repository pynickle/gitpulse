export interface PendingPaginationPage {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalPages: number | null;
}

/**
 * Optimistic pagination meta for a requested page. Callers apply this as soon
 * as the user picks a page so the current-page highlight (and hasPrev/hasNext)
 * update before the list response arrives.
 */
export default function withPendingPaginationPage<T extends PendingPaginationPage>(
  pagination: T,
  page: number
): T {
  if (!Number.isSafeInteger(page) || page < 1 || pagination.page === page) {
    return pagination;
  }

  return {
    ...pagination,
    page,
    hasPrev: page > 1,
    hasNext:
      pagination.totalPages != null && pagination.totalPages > 0
        ? page < pagination.totalPages
        : page < pagination.page || pagination.hasNext,
  };
}
