import type { LocationQuery, LocationQueryRaw } from 'vue-router';

import {
  buildChildPageRouteFromNavigationEntry,
  buildDashboardQueryFromNavigationEntry,
  parseDashboardDetailTarget,
  parseDashboardReleaseQuery,
  parseDashboardUrlTarget,
  parseRepoDetailListState,
  parseRepoDetailPage,
  parseRepoDetailSection,
  type DashboardNavigationEntry,
  type DashboardUrlTarget,
} from './dashboardUrlNavigationUtils';
import getQueryParamValue from './getQueryParamValue';
import parseGitHubRepoPath from './parseGitHubRepoPath';

/**
 * Pure route <-> logical-navigation-entry derivation. The navigation history
 * stack is driven entirely by router.afterEach (see
 * plugins/navigation-history.client.ts); pages and components never record
 * entries manually.
 */

export interface NavigationRouteLocation {
  path: string;
  query: LocationQuery | LocationQueryRaw;
}

const DASHBOARD_CHILD_MARKER = '/dashboard/';

function normalizePath(path: string) {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed || '/';
}

/** Matches the dashboard root on every locale prefix (`/dashboard`, `/zh-cn/dashboard`). */
export function isDashboardRootPath(path: string) {
  return normalizePath(path).endsWith('/dashboard');
}

function getDashboardChildSegment(path: string): string | null {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf(DASHBOARD_CHILD_MARKER);
  if (index === -1) return null;
  return normalized.slice(index + DASHBOARD_CHILD_MARKER.length);
}

export function isDashboardAreaPath(path: string) {
  return isDashboardRootPath(path) || getDashboardChildSegment(path) !== null;
}

const getTab = (query: NavigationRouteLocation['query']) => {
  return getQueryParamValue(query.tab)?.trim() || undefined;
};

function dashboardEntry(tab?: string): DashboardNavigationEntry {
  return tab ? { type: 'dashboard', data: { tab } } : { type: 'dashboard' };
}

function entryFromDashboardUrlTarget(
  target: DashboardUrlTarget,
  tab: string | undefined
): DashboardNavigationEntry {
  if (target.type === 'release') {
    return {
      type: 'release',
      data: {
        owner: target.owner,
        repo: target.repo,
        number: target.releaseRef.kind === 'id' ? target.releaseRef.id : undefined,
        releaseRef: target.releaseRef,
        tab,
      },
    };
  }

  if (target.type === 'repository') {
    return {
      type: 'repository',
      data: {
        owner: target.owner,
        repo: target.repo,
        branch: target.branch,
        tab,
        section: undefined,
        repoPage: undefined,
        repoState: undefined,
      },
    };
  }

  if (target.type === 'file') {
    return {
      type: 'file',
      data: {
        owner: target.owner,
        repo: target.repo,
        path: target.path,
        branch: target.branch,
        tab,
      },
    };
  }

  return {
    type: target.type,
    data: { owner: target.owner, repo: target.repo, number: target.number, tab },
  };
}

function childRouteToNavigationEntry(
  segment: string,
  query: NavigationRouteLocation['query']
): DashboardNavigationEntry {
  if (segment === 'profile') {
    const user = getQueryParamValue(query.user)?.trim() || undefined;
    const tab = getTab(query);
    return { type: 'profile', data: user || tab ? { user, tab } : undefined };
  }

  if (segment === 'package') {
    const user = getQueryParamValue(query.user)?.trim();
    const packageType = getQueryParamValue(query.type)?.trim();
    const packageName = getQueryParamValue(query.name)?.trim();

    if (user && packageType && packageName) {
      return {
        type: 'package',
        data: {
          user,
          packageType,
          packageName,
          packageOrganization:
            getQueryParamValue(query.account) === 'organization' ? true : undefined,
        },
      };
    }

    return dashboardEntry();
  }

  if (segment === 'releases') {
    const repoPath = parseGitHubRepoPath(getQueryParamValue(query.repo));
    if (repoPath) {
      return { type: 'releases-list', data: { owner: repoPath.owner, repo: repoPath.repo } };
    }
    return dashboardEntry();
  }

  if (segment === 'branches') {
    const repoPath = parseGitHubRepoPath(getQueryParamValue(query.repo));
    if (repoPath) {
      return { type: 'branches-list', data: { owner: repoPath.owner, repo: repoPath.repo } };
    }
    return dashboardEntry();
  }

  if (segment === 'contributors') {
    const repoPath = parseGitHubRepoPath(getQueryParamValue(query.repo));
    if (repoPath) {
      return {
        type: 'contributors-list',
        data: { owner: repoPath.owner, repo: repoPath.repo },
      };
    }
    return dashboardEntry();
  }

  if (segment === 'wiki') {
    const repoPath = parseGitHubRepoPath(getQueryParamValue(query.repo));
    if (repoPath) {
      return {
        type: 'wiki',
        data: {
          owner: repoPath.owner,
          repo: repoPath.repo,
          path: getQueryParamValue(query.page)?.trim() || undefined,
        },
      };
    }
    return dashboardEntry();
  }

  if (segment === 'starred') {
    const user = getQueryParamValue(query.user)?.trim() || undefined;
    return { type: 'starred', data: user ? { user } : undefined };
  }

  if (segment === 'settings') {
    return { type: 'settings' };
  }

  if (segment === 'tabs') {
    return { type: 'tabs-settings' };
  }

  // Unrecognized child pages do not participate in the logical history; they
  // behave like the dashboard root.
  return dashboardEntry();
}

/**
 * Derives the logical navigation entry for a route. Returns null for routes
 * outside the dashboard area (landing, auth, ...), which resets the stack.
 * Detail-query precedence mirrors the dashboard detail watcher.
 */
export function routeToNavigationEntry(
  route: NavigationRouteLocation
): DashboardNavigationEntry | null {
  const childSegment = getDashboardChildSegment(route.path);
  if (childSegment !== null) {
    return childRouteToNavigationEntry(childSegment, route.query);
  }

  if (!isDashboardRootPath(route.path)) {
    return null;
  }

  const query = route.query;
  const tab = getTab(query);

  const issueTarget = parseDashboardDetailTarget(query.issue);
  if (issueTarget) {
    return { type: 'issue', data: { ...issueTarget, tab } };
  }

  const prReviewTarget = parseDashboardDetailTarget(query.prReview);
  if (prReviewTarget) {
    return { type: 'pull-request-review', data: { ...prReviewTarget, tab } };
  }

  const prTarget = parseDashboardDetailTarget(query.pr);
  if (prTarget) {
    return { type: 'pull-request', data: { ...prTarget, tab } };
  }

  const discussionTarget = parseDashboardDetailTarget(query.discussion);
  if (discussionTarget) {
    return { type: 'discussion', data: { ...discussionTarget, tab } };
  }

  const releaseTarget = parseDashboardReleaseQuery(query.release, query.releaseTag);
  if (releaseTarget) {
    return {
      type: 'release',
      data: {
        owner: releaseTarget.owner,
        repo: releaseTarget.repo,
        number: releaseTarget.releaseRef.kind === 'id' ? releaseTarget.releaseRef.id : undefined,
        releaseRef: releaseTarget.releaseRef,
        tab,
      },
    };
  }

  const repoPath = parseGitHubRepoPath(getQueryParamValue(query.repo));
  if (repoPath) {
    const branch = getQueryParamValue(query.branch) || undefined;

    if (Object.hasOwn(query, 'path')) {
      return {
        type: 'file',
        data: {
          owner: repoPath.owner,
          repo: repoPath.repo,
          path: getQueryParamValue(query.path) ?? '',
          branch,
          tab,
        },
      };
    }

    const section = parseRepoDetailSection(query.section);
    const repoPage = parseRepoDetailPage(query.repoPage);
    // State only applies to issue/PR lists; ignore for files/commits.
    const repoState =
      section === 'issues' || section === 'pulls'
        ? parseRepoDetailListState(query.repoState)
        : undefined;

    return {
      type: 'repository',
      data: {
        owner: repoPath.owner,
        repo: repoPath.repo,
        branch,
        tab,
        section,
        repoPage,
        repoState,
      },
    };
  }

  // `?url=` deep links are normalized away by the dashboard, but derive the
  // target entry directly so the transient URL still records correctly.
  const urlTarget = parseDashboardUrlTarget(getQueryParamValue(query.url));
  if (urlTarget) {
    return entryFromDashboardUrlTarget(urlTarget, tab);
  }

  return dashboardEntry(tab);
}

const getReleaseRefValue = (entry: DashboardNavigationEntry | null | undefined) => {
  const releaseRef = entry?.data?.releaseRef;
  if (!releaseRef) return undefined;
  return releaseRef.kind === 'id' ? releaseRef.id : releaseRef.tag;
};

export function isSameNavigationEntry(
  left: DashboardNavigationEntry | null | undefined,
  right: DashboardNavigationEntry | null | undefined
) {
  if (!left || !right) return false;

  return (
    left.type === right.type &&
    left.data?.owner === right.data?.owner &&
    left.data?.repo === right.data?.repo &&
    left.data?.number === right.data?.number &&
    left.data?.tab === right.data?.tab &&
    left.data?.path === right.data?.path &&
    left.data?.branch === right.data?.branch &&
    left.data?.section === right.data?.section &&
    left.data?.repoPage === right.data?.repoPage &&
    left.data?.repoState === right.data?.repoState &&
    left.data?.releaseRef?.kind === right.data?.releaseRef?.kind &&
    getReleaseRefValue(left) === getReleaseRefValue(right) &&
    left.data?.user === right.data?.user &&
    left.data?.packageType === right.data?.packageType &&
    left.data?.packageName === right.data?.packageName &&
    left.data?.packageOrganization === right.data?.packageOrganization
  );
}

const isSameRepo = (
  left: DashboardNavigationEntry | null | undefined,
  right: DashboardNavigationEntry
) => {
  return left?.data?.owner === right.data?.owner && left?.data?.repo === right.data?.repo;
};

/**
 * Same-page parameter changes update the current entry in place instead of
 * pushing history. Rules distilled from the legacy manual recording:
 * - identical entries (legacy pushEntry dedupe),
 * - same-user profile tab switches, same-user starred lists,
 * - same-repo wiki page switches,
 * - continuous file browsing (file -> file, legacy navigateToFile),
 * - same-repo repository branch/tab changes (legacy syncRepositoryEntry) and
 *   file -> repository within one repo (leaving file browsing upward),
 * - closing a PR review back onto the same pull request,
 * - dashboard-root tab switches (never stacked in the legacy system).
 */
export function shouldReplaceNavigationEntry(
  previous: DashboardNavigationEntry | null | undefined,
  next: DashboardNavigationEntry
) {
  if (!previous) return false;
  if (isSameNavigationEntry(previous, next)) return true;

  if (next.type === 'dashboard') {
    return previous.type === 'dashboard';
  }

  if (next.type === 'profile') {
    return previous.type === 'profile' && previous.data?.user === next.data?.user;
  }

  if (next.type === 'starred') {
    return previous.type === 'starred' && previous.data?.user === next.data?.user;
  }

  if (next.type === 'wiki') {
    return previous.type === 'wiki' && isSameRepo(previous, next);
  }

  if (next.type === 'file') {
    return previous.type === 'file';
  }

  if (next.type === 'repository') {
    return (
      (previous.type === 'repository' || previous.type === 'file') && isSameRepo(previous, next)
    );
  }

  if (next.type === 'pull-request') {
    return (
      previous.type === 'pull-request-review' &&
      isSameRepo(previous, next) &&
      previous.data?.number === next.data?.number
    );
  }

  return false;
}

export interface ResolveNavigationEntryRouteOptions {
  /**
   * Residual dashboard-root query (detail keys already cleared) to preserve
   * when resolving back onto the dashboard. Pass it only while the current
   * route is the dashboard root; child pages resolve without residue.
   */
  dashboardQuery?: LocationQueryRaw;
}

export interface ResolvedNavigationEntryRoute {
  path: string;
  query: LocationQueryRaw;
}

/**
 * The single entry -> route resolver: child-page routes first, then dashboard
 * detail queries, falling back to the dashboard root. Callers wrap `path`
 * with `localePath()` before pushing.
 */
export function resolveNavigationEntryRoute(
  entry: DashboardNavigationEntry | null | undefined,
  options: ResolveNavigationEntryRouteOptions = {}
): ResolvedNavigationEntryRoute {
  const childRoute = buildChildPageRouteFromNavigationEntry(entry);
  if (childRoute) {
    return childRoute;
  }

  const query = buildDashboardQueryFromNavigationEntry(entry, { repositoryTab: 'repos' });
  if (query) {
    return {
      path: '/dashboard',
      query: { ...options.dashboardQuery, ...query },
    };
  }

  const tab = entry?.data?.tab;
  return {
    path: '/dashboard',
    query: { ...options.dashboardQuery, ...(tab ? { tab } : {}) },
  };
}

export interface NavigationHistoryState {
  history: DashboardNavigationEntry[];
  current: DashboardNavigationEntry | null;
}

export type NavigationHistoryChange =
  | { kind: 'reset' }
  | { kind: 'replace' }
  | { kind: 'push' }
  | { kind: 'pop'; depth: number };

/** Drops stack tops that equal the current entry so Back never lands in place. */
function dedupeAgainstCurrent(state: NavigationHistoryState): NavigationHistoryState {
  let { history } = state;
  while (history.length > 0 && isSameNavigationEntry(history[history.length - 1], state.current)) {
    history = history.slice(0, -1);
  }
  return history === state.history ? state : { history, current: state.current };
}

/**
 * The single reducer behind the navigation history stack. `entry` is the
 * derived entry for the new route (null outside the dashboard area).
 * - reset: cold start / leaving the dashboard area,
 * - replace: same-position navigation (router.replace, logical back/home),
 * - push: forward navigation, applying the in-place collapse rules,
 * - pop: browser back by `depth` steps (best effort).
 *
 * `replace` also falls back to pushing when no collapse rule holds: every
 * legitimate same-position navigation (tab switches, canonicalization, logical
 * back/home) satisfies a collapse rule, so a non-collapsible "replace" only
 * happens when browser positions desynced (e.g. a cancelled popstate followed
 * by a link click) — losing the current entry there would corrupt Back.
 */
export function applyNavigationHistoryChange(
  state: NavigationHistoryState,
  entry: DashboardNavigationEntry | null,
  change: NavigationHistoryChange
): NavigationHistoryState {
  if (change.kind === 'reset' || state.current === null) {
    return { history: [], current: entry };
  }

  if (entry === null) {
    return { history: [], current: null };
  }

  if (change.kind === 'pop') {
    const maxDepth = Math.min(Math.max(change.depth, 0), state.history.length);
    for (let steps = 1; steps <= maxDepth; steps += 1) {
      const index = state.history.length - steps;
      if (isSameNavigationEntry(state.history[index], entry)) {
        return { history: state.history.slice(0, index), current: entry };
      }
    }
    // No matching entry within reach: sync the current entry without popping.
    return { history: state.history, current: entry };
  }

  if (shouldReplaceNavigationEntry(state.current, entry)) {
    return dedupeAgainstCurrent({ history: state.history, current: entry });
  }

  return { history: [...state.history, state.current], current: entry };
}
