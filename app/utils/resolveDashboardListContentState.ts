export type DashboardListContentState = 'loading' | 'empty' | 'items';

export interface DashboardListContentInput {
  /** A list request is in flight for the active tab (initial load, tab switch, page change). */
  loading: boolean;
  /** Rows the active tab would render right now. */
  rowCount: number;
}

/**
 * What the dashboard list region renders. Loading outranks emptiness: an
 * in-flight request has not produced rows yet, so claiming "no results" under
 * the loading skeleton tells the reader something the app does not know.
 */
export function resolveDashboardListContentState({
  loading,
  rowCount,
}: DashboardListContentInput): DashboardListContentState {
  if (loading) {
    return 'loading';
  }

  return rowCount > 0 ? 'items' : 'empty';
}
