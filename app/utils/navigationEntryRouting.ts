import type { LocationQuery, LocationQueryRaw } from 'vue-router';

import {
  buildChildPageRouteFromNavigationEntry,
  buildDashboardQueryFromNavigationEntry,
  clearDashboardDetailQuery,
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
 * Logical Navigation: route <-> entry derivation plus the sequential event
 * interface (`applyLogicalNavigationEvent`). vue-router and window.history
 * stay as adapters; pages never record entries manually.
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

  if (segment === 'release-follows') {
    return { type: 'release-follows' };
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
function shouldReplaceNavigationEntry(
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

interface NavigationHistoryState {
  history: DashboardNavigationEntry[];
  current: DashboardNavigationEntry | null;
}

type NavigationHistoryChange =
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
function applyNavigationHistoryChange(
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

export type NavigationIntent = 'back' | 'home';

export type NavigationDecision = 'reset' | 'replace' | 'push' | 'pop';

export type LogicalNavigationEvent =
  | {
      type: 'route';
      route: NavigationRouteLocation;
      position: number | null;
      failed?: boolean;
    }
  | { type: 'back'; route: NavigationRouteLocation }
  | { type: 'home'; route: NavigationRouteLocation }
  | { type: 'cancel-intent' };

export interface LogicalNavigationState {
  history: DashboardNavigationEntry[];
  current: DashboardNavigationEntry | null;
  lastPosition: number | null;
  pendingIntent: NavigationIntent | null;
}

export interface LogicalNavigationSnapshot {
  history: DashboardNavigationEntry[];
  current: DashboardNavigationEntry | null;
  previousEntry: DashboardNavigationEntry | null;
  canGoBack: boolean;
  shouldShowHomeButton: boolean;
}

export interface LogicalNavigationResult {
  state: LogicalNavigationState;
  entry: DashboardNavigationEntry | null;
  decision: NavigationDecision | null;
  target: ResolvedNavigationEntryRoute | null;
  snapshot: LogicalNavigationSnapshot;
}

export function createLogicalNavigationState(): LogicalNavigationState {
  return {
    history: [],
    current: null,
    lastPosition: null,
    pendingIntent: null,
  };
}

export function getLogicalNavigationSnapshot(
  state: LogicalNavigationState
): LogicalNavigationSnapshot {
  const previousEntry = state.history.length > 0 ? state.history[state.history.length - 1]! : null;
  const canGoBack = state.history.length > 0;
  const shouldShowHomeButton = Boolean(
    state.current && canGoBack && previousEntry?.type !== 'dashboard'
  );

  return {
    history: state.history,
    current: state.current,
    previousEntry,
    canGoBack,
    shouldShowHomeButton,
  };
}

function logicalNavigationResult(
  state: LogicalNavigationState,
  extras: Partial<Pick<LogicalNavigationResult, 'entry' | 'decision' | 'target'>> = {}
): LogicalNavigationResult {
  return {
    state,
    entry: extras.entry === undefined ? state.current : extras.entry,
    decision: extras.decision ?? null,
    target: extras.target ?? null,
    snapshot: getLogicalNavigationSnapshot(state),
  };
}

function resolveBackHomeTarget(
  entry: DashboardNavigationEntry | null,
  currentRoute: NavigationRouteLocation
): ResolvedNavigationEntryRoute {
  return resolveNavigationEntryRoute(entry, {
    dashboardQuery: isDashboardRootPath(currentRoute.path)
      ? clearDashboardDetailQuery(currentRoute.query)
      : undefined,
  });
}

function applyDerivedEntry(
  state: LogicalNavigationState,
  entry: DashboardNavigationEntry | null,
  change: NavigationHistoryChange,
  lastPosition: number | null
): LogicalNavigationState {
  const applied = applyNavigationHistoryChange(
    { history: state.history, current: state.current },
    entry,
    change
  );
  return { ...state, ...applied, lastPosition };
}

/**
 * The single Logical Navigation interface: consecutive events (route +
 * position, logical Back/Home, or a cancelled intent) produce the
 * route-derived entry, Back/Home target, and push/replace/browser-back
 * decision. vue-router and window.history stay as adapters.
 */
export function applyLogicalNavigationEvent(
  state: LogicalNavigationState,
  event: LogicalNavigationEvent
): LogicalNavigationResult {
  if (event.type === 'cancel-intent') {
    return logicalNavigationResult({ ...state, pendingIntent: null });
  }

  if (event.type === 'back') {
    const popped = state.history.length > 0 ? state.history[state.history.length - 1]! : null;
    const next: LogicalNavigationState = {
      ...state,
      history: state.history.length > 0 ? state.history.slice(0, -1) : [],
      current: popped ?? { type: 'dashboard' },
      pendingIntent: 'back',
    };
    return logicalNavigationResult(next, {
      entry: popped,
      target: resolveBackHomeTarget(popped, event.route),
    });
  }

  if (event.type === 'home') {
    const current: DashboardNavigationEntry = { type: 'dashboard' };
    const next: LogicalNavigationState = {
      ...state,
      history: [],
      current,
      pendingIntent: 'home',
    };
    return logicalNavigationResult(next, {
      entry: current,
      target: resolveBackHomeTarget(current, event.route),
    });
  }

  const pendingIntent = state.pendingIntent;
  const consumed: LogicalNavigationState = { ...state, pendingIntent: null };

  if (event.failed) {
    return logicalNavigationResult(consumed, {
      entry: consumed.current,
      decision: null,
    });
  }

  const entry = routeToNavigationEntry(event.route);

  if (entry === null || consumed.lastPosition === null) {
    const next: LogicalNavigationState = {
      ...consumed,
      history: [],
      current: entry,
      lastPosition: event.position,
    };
    return logicalNavigationResult(next, { entry, decision: 'reset' });
  }

  if (pendingIntent !== null) {
    return logicalNavigationResult(
      applyDerivedEntry(consumed, entry, { kind: 'replace' }, event.position),
      { entry, decision: 'replace' }
    );
  }

  const delta = event.position === null ? 1 : event.position - consumed.lastPosition;
  const lastPosition = event.position !== null ? event.position : consumed.lastPosition;

  if (delta < 0) {
    return logicalNavigationResult(
      applyDerivedEntry(consumed, entry, { kind: 'pop', depth: -delta }, lastPosition),
      { entry, decision: 'pop' }
    );
  }

  const decision: NavigationDecision = delta === 0 ? 'replace' : 'push';
  return logicalNavigationResult(
    applyDerivedEntry(consumed, entry, { kind: decision }, lastPosition),
    { entry, decision }
  );
}
