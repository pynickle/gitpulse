import { computed, watch } from 'vue';

import type {
  RepoLanguagesPayload,
  RepoLatestCommitPayload,
  RepositoryDetailPayload,
} from '#shared/types/repos';

import { useRepoCommitList } from '../useRepoCommitList';
import { useRepoIssuePrList } from '../useRepoIssuePrList';
import { createRepoDetailLocation } from './location';
import { createRepoDetailResource } from './resource';

export type { RepoDetailPanel } from './location';

interface ReadmeEntry {
  content: string | null;
  path: string | null;
}

export interface RepoLicenseInfo {
  name: string | null;
  spdxId: string | null;
  url: string | null;
  path: string | null;
}

export interface UseRepoDetailSessionOptions {
  owner: () => string;
  repo: () => string;
  repository: () => RepositoryDetailPayload;
}

/**
 * Repository detail session: owns route-backed panel state, per-panel data
 * lifecycles (files / commits / issues / PRs), and session-cached sidebar
 * resources (readme, license, latest commit, languages). The view consumes
 * this one interface instead of coordinating composables and the router.
 */
export function useRepoDetailSession(options: UseRepoDetailSessionOptions) {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();
  const apiFetch = useGitPulseApiFetch();

  const location = createRepoDetailLocation({ route, router });
  const { activePanel, listState, isListPanel, listKind } = location;

  const files = useRepoFiles();

  const repoDefaultBranch = computed(
    () => files.defaultBranch.value || options.repository().default_branch || ''
  );
  const repoCurrentBranch = computed(() => files.currentBranch.value || repoDefaultBranch.value);
  const canonicalBranch = computed(() => repoCurrentBranch.value || undefined);
  const currentBranchQueryValue = computed(() =>
    repoCurrentBranch.value && repoCurrentBranch.value !== repoDefaultBranch.value
      ? repoCurrentBranch.value
      : undefined
  );

  // Only query while the matching panel is open — keep other panels free of traffic.
  const listOwner = computed(() => (isListPanel.value ? options.owner() : ''));
  const listRepo = computed(() => (isListPanel.value ? options.repo() : ''));
  const commitsOwner = computed(() => (activePanel.value === 'commits' ? options.owner() : ''));
  const commitsRepo = computed(() => (activePanel.value === 'commits' ? options.repo() : ''));
  // Empty ref lets the API use the default branch; named refs follow the branch selector.
  const commitsRef = computed(() => currentBranchQueryValue.value ?? '');

  const list = useRepoIssuePrList(listOwner, listRepo, listKind, listState, {
    getResumePage: () => location.resumeListPage.value,
  });

  const commits = useRepoCommitList(commitsOwner, commitsRepo, commitsRef, {
    getResumePage: () => location.resumeCommitsPage.value,
  });

  const goToListPage = async (page: number) => {
    location.resumeListPage.value = page;
    await list.goToPage(page);
    await location.sync();
  };

  const goToCommitsPage = async (page: number) => {
    location.resumeCommitsPage.value = page;
    await commits.goToPage(page);
    await location.sync();
  };

  const buildRefQuery = () => {
    const branch = currentBranchQueryValue.value;
    return branch ? `?ref=${encodeURIComponent(branch)}` : '';
  };

  const buildBranchScopedCacheKey = () => {
    const branch = repoCurrentBranch.value || options.repository().default_branch || '';
    return `${options.owner()}/${options.repo()}@${branch}`;
  };

  const buildRepoCacheKey = () => `${options.owner()}/${options.repo()}`;

  const readme = createRepoDetailResource<ReadmeEntry>(
    async () => {
      const data = await apiFetch<{ content: string | null; path?: string | null }>(
        `/api/repos/${options.owner()}/${options.repo()}/readme${buildRefQuery()}`
      );
      return { content: data.content, path: data.path ?? null };
    },
    {
      fallback: () => ({ content: null, path: null }),
      cacheFallbackOnError: true,
    }
  );

  const license = createRepoDetailResource<RepoLicenseInfo | null>(
    () =>
      apiFetch<RepoLicenseInfo>(
        `/api/repos/${options.owner()}/${options.repo()}/license${buildRefQuery()}`
      ),
    {
      fallback: () => null,
      cacheFallbackOnError: true,
    }
  );

  // Failures stay retryable (no negative caching) and surface a message.
  const latestCommit = createRepoDetailResource<RepoLatestCommitPayload | null>(
    () =>
      apiFetch<RepoLatestCommitPayload | null>(
        `/api/repos/${options.owner()}/${options.repo()}/latest-commit${buildRefQuery()}`
      ),
    {
      fallback: () => null,
      errorMessage: () => t('repoDetail.commitLoadError'),
    }
  );

  // Languages are repo-scoped (GitHub has no ref param on this endpoint).
  const languages = createRepoDetailResource<RepoLanguagesPayload | null>(
    () =>
      apiFetch<RepoLanguagesPayload>(`/api/repos/${options.owner()}/${options.repo()}/languages`),
    {
      fallback: () => null,
      cacheFallbackOnError: true,
    }
  );

  const loadLatestCommit = async (loadOptions: { force?: boolean } = {}) => {
    // The latest-commit bar only renders on the Files panel.
    if (activePanel.value !== 'files') return;
    if (!repoCurrentBranch.value && !options.repository().default_branch) return;

    await latestCommit.load(buildBranchScopedCacheKey(), loadOptions);
  };

  const refreshLatestCommit = () => loadLatestCommit({ force: true });

  watch(
    () => [options.owner(), options.repo(), repoCurrentBranch.value] as const,
    ([owner, repo], previous) => {
      if (!repoCurrentBranch.value) return;

      // New repository instance: drop session caches from the previous repo.
      if (previous && (previous[0] !== owner || previous[1] !== repo)) {
        readme.clear();
        license.clear();
        latestCommit.clear();
      }

      const cacheKey = buildBranchScopedCacheKey();
      void readme.load(cacheKey);
      void license.load(cacheKey);
      void loadLatestCommit();
    },
    { immediate: true }
  );

  // Languages are repo-wide (not branch-scoped); load as soon as owner/repo are known.
  watch(
    () => [options.owner(), options.repo()] as const,
    ([owner, repo], previous) => {
      if (!owner || !repo) return;

      if (previous && (previous[0] !== owner || previous[1] !== repo)) {
        languages.clear();
      }

      void languages.load(buildRepoCacheKey());
    },
    { immediate: true }
  );

  watch(activePanel, (panel) => {
    if (panel === 'files') {
      void loadLatestCommit();
    }
  });

  // Repository switch: land back on the Files panel with fresh list state.
  watch(
    () => [options.owner(), options.repo()] as const,
    (_, previous) => {
      if (!previous) return;
      void location.resetForRepo();
    }
  );

  return {
    // Panel location
    activePanel,
    listState,
    isListPanel,
    listKind,
    selectPanel: location.selectPanel,
    selectListState: location.selectListState,

    // Branch context
    repoDefaultBranch,
    repoCurrentBranch,
    canonicalBranch,
    currentBranchQueryValue,

    // Files panel
    branches: files.branches,
    directoryContents: files.directoryContents,
    loadingFiles: files.loading,
    filesError: files.error,
    navigateToBranch: files.navigateToBranch,

    // Issues / PRs panel
    listItems: list.items,
    listLoading: list.loading,
    listError: list.error,
    listPagination: list.pagination,
    listShowPagination: list.showPagination,
    listRefresh: list.refresh,
    goToListPage,

    // Commits panel
    commitItems: commits.items,
    commitsLoading: commits.loading,
    commitsError: commits.error,
    commitsPagination: commits.pagination,
    commitsShowPagination: commits.showPagination,
    commitsRefresh: commits.refresh,
    goToCommitsPage,

    // Session-cached sidebar resources
    readmeContent: computed(() => readme.data.value.content),
    readmePath: computed(() => readme.data.value.path),
    loadingReadme: readme.loading,
    licenseInfo: license.data,
    loadingLicense: license.loading,
    latestCommit: latestCommit.data,
    loadingLatestCommit: latestCommit.loading,
    latestCommitError: latestCommit.error,
    refreshLatestCommit,
    languageBytes: languages.data,
    loadingLanguages: languages.loading,
  };
}

export type RepoDetailSession = ReturnType<typeof useRepoDetailSession>;
