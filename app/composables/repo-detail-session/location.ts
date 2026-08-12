import { computed, shallowRef } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import {
  buildRepoDetailPanelQuery,
  parseRepoDetailListState,
  parseRepoDetailPage,
  parseRepoDetailSection,
  type RepoDetailSection,
} from '~/utils/dashboardUrlNavigationUtils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import {
  normalizeRepoIssuePrState,
  type RepoIssuePrKind,
  type RepoIssuePrState,
} from '~/utils/repoIssuePrSearchQuery';

export type RepoDetailPanel = 'files' | 'commits' | RepoIssuePrKind;

interface RepoDetailRouteLike {
  path: string;
  query: Record<string, unknown>;
}

interface RepoDetailRouterLike {
  replace: (location: { path?: string; query: LocationQueryRaw }) => Promise<unknown>;
}

export interface RepoDetailLocationOptions {
  route: RepoDetailRouteLike;
  router: RepoDetailRouterLike;
}

/**
 * Route-backed panel location for repository detail: which panel is open,
 * the issue/PR state filter, and per-panel resume pages. Owns the
 * `section` / `repoPage` / `repoState` query keys so Back navigation can
 * restore the exact panel position.
 */
export function createRepoDetailLocation({ route, router }: RepoDetailLocationOptions) {
  // Restore panel/page/state from the route so Back remounts on the same place.
  const initialSection = parseRepoDetailSection(route.query.section);
  const initialPanel: RepoDetailPanel = initialSection ?? 'files';
  const initialPage = parseRepoDetailPage(route.query.repoPage) ?? 1;
  const initialListState: RepoIssuePrState =
    initialSection === 'issues' || initialSection === 'pulls'
      ? normalizeRepoIssuePrState(
          initialSection,
          parseRepoDetailListState(route.query.repoState) ?? 'open'
        )
      : 'open';

  const activePanel = shallowRef<RepoDetailPanel>(initialPanel);
  const listState = shallowRef<RepoIssuePrState>(initialListState);
  /** Resume page for Issues/PRs when the list panel activates or remounts. */
  const resumeListPage = shallowRef(
    initialPanel === 'issues' || initialPanel === 'pulls' ? initialPage : 1
  );
  /** Resume page for Commits when that panel activates or remounts. */
  const resumeCommitsPage = shallowRef(initialPanel === 'commits' ? initialPage : 1);

  const isListPanel = computed(
    () => activePanel.value === 'issues' || activePanel.value === 'pulls'
  );
  const listKind = computed<RepoIssuePrKind>(() =>
    activePanel.value === 'pulls' ? 'pulls' : 'issues'
  );

  /** Keep `section` / `repoPage` / `repoState` in the URL so navigation history can restore them. */
  const sync = async () => {
    if (!getQueryParamValue(route.query.repo)) return;
    // File browsing owns `path` and is a separate navigation entry.
    if (Object.hasOwn(route.query, 'path')) return;

    const section: RepoDetailSection | undefined =
      activePanel.value === 'files' ? undefined : (activePanel.value as RepoDetailSection);
    const page =
      activePanel.value === 'commits'
        ? resumeCommitsPage.value
        : isListPanel.value
          ? resumeListPage.value
          : 1;
    const repoState: RepoIssuePrState | undefined = isListPanel.value ? listState.value : undefined;

    const panelQuery = buildRepoDetailPanelQuery({
      section,
      repoPage: page,
      repoState,
    });

    const nextSection = getQueryParamValue(panelQuery.section) || undefined;
    const nextPage = getQueryParamValue(panelQuery.repoPage) || undefined;
    const nextState = getQueryParamValue(panelQuery.repoState) || undefined;
    const currentSection = getQueryParamValue(route.query.section) || undefined;
    const currentPage = getQueryParamValue(route.query.repoPage) || undefined;
    const currentState = getQueryParamValue(route.query.repoState) || undefined;

    if (currentSection === nextSection && currentPage === nextPage && currentState === nextState) {
      return;
    }

    await router.replace({
      path: route.path,
      query: {
        ...(route.query as LocationQueryRaw),
        section: panelQuery.section,
        repoPage: panelQuery.repoPage,
        repoState: panelQuery.repoState,
      },
    });
  };

  const selectPanel = async (value: RepoDetailPanel) => {
    activePanel.value = value;
    if (value === 'issues' || value === 'pulls') {
      listState.value = 'open';
      resumeListPage.value = 1;
    }
    if (value === 'commits') {
      resumeCommitsPage.value = 1;
    }
    await sync();
  };

  const selectListState = async (value: RepoIssuePrState) => {
    listState.value = normalizeRepoIssuePrState(listKind.value, value);
    resumeListPage.value = 1;
    await sync();
  };

  const setListPage = async (page: number) => {
    resumeListPage.value = page;
    await sync();
  };

  const setCommitsPage = async (page: number) => {
    resumeCommitsPage.value = page;
    await sync();
  };

  /** Repository switch: back to the Files panel with fresh list state. */
  const resetForRepo = async () => {
    activePanel.value = 'files';
    listState.value = 'open';
    resumeListPage.value = 1;
    resumeCommitsPage.value = 1;
    await sync();
  };

  return {
    activePanel,
    listState,
    resumeListPage,
    resumeCommitsPage,
    isListPanel,
    listKind,
    selectPanel,
    selectListState,
    setListPage,
    setCommitsPage,
    resetForRepo,
    sync,
  };
}

export type RepoDetailLocation = ReturnType<typeof createRepoDetailLocation>;
