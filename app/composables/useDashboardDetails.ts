import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import type { DiscussionDetailPayload } from '#shared/types/discussions';
import type { IssueDetailPayload } from '#shared/types/issues';
import type { DashboardNotification } from '#shared/types/notifications';
import type { PullRequestDetailResponse, PullRequestDetailViewModel } from '#shared/types/pulls';
import type { ReleaseDetailPayload } from '#shared/types/releases';
import type { RepositoryDetailPayload } from '#shared/types/repos';
import createPullRequestDetailViewModel from '~/utils/createPullRequestDetailViewModel';
import {
  DASHBOARD_DETAIL_QUERY_KEYS,
  clearDashboardDetailQuery,
  createDashboardDiscussionTarget,
  createDashboardIssueTarget,
  createDashboardPullRequestReviewTarget,
  createDashboardPullRequestTarget,
  createDashboardReleaseTarget,
  parseDashboardDetailTarget,
  parseDashboardReleaseQuery,
  serializeDashboardDetailTarget,
  serializeDashboardRepoTarget,
  serializeReleaseQuery,
  type DashboardDetailQueryKey,
  type DashboardDetailTarget,
  type DashboardReleaseTarget,
  type ReleaseDashboardRef,
} from '~/utils/dashboardUrlNavigationUtils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

interface DashboardDetailListItem {
  repository_url?: string | null;
  number?: number | null;
  [key: string]: unknown;
}

type DetailType = 'issue' | 'pull-request' | 'discussion';

const DETAIL_QUERY_KEY: Record<DetailType, DashboardDetailQueryKey> = {
  issue: 'issue',
  'pull-request': 'pr',
  discussion: 'discussion',
};

type DetailTarget = DashboardDetailTarget;
type ReleaseDetailTarget = DashboardReleaseTarget;

const getReleaseRefValue = (releaseRef: ReleaseDashboardRef | undefined) => {
  if (!releaseRef) return undefined;
  return releaseRef.kind === 'id' ? releaseRef.id : releaseRef.tag;
};

interface DetailPanelLoadOptions<TData> {
  logPrefix: string;
  fallbackError?: string;
  onSuccess?: (data: TData) => void;
}

const createDetailPanel = <TData>() => {
  const visible = ref(false);
  const data = ref<TData | null>(null) as Ref<TData | null>;
  const error = ref('');
  const loading = ref(false);
  let requestId = 0;

  const close = () => {
    requestId += 1;
    visible.value = false;
    data.value = null;
    error.value = '';
    loading.value = false;
  };

  const load = async (fetcher: () => Promise<TData>, options: DetailPanelLoadOptions<TData>) => {
    const id = ++requestId;
    data.value = null;
    error.value = '';
    loading.value = true;

    await nextTick();

    try {
      const result = await fetcher();
      if (id !== requestId) return;
      data.value = result;
      options.onSuccess?.(result);
    } catch (fetchError) {
      console.error(options.logPrefix, fetchError);
      if (id === requestId && options.fallbackError) {
        error.value = getFetchErrorMessage(fetchError, options.fallbackError);
      }
    } finally {
      if (id === requestId) {
        loading.value = false;
      }
    }
  };

  return { visible, data, error, loading, close, load };
};

export function useDashboardDetails(currentRouteTab: Ref<string>) {
  const { t } = useI18n();
  const apiFetch = useGitPulseApiFetch();
  const { loggedIn, ready: sessionReady } = useUserSession();
  const { getNotificationDetails, openExternalNotification } = useUrlHelper();
  const { opensGitHubLinks, openGitHubTarget } = useGitHubLinkRouting();
  const { goBackToPreviousPage, goToDashboardHome } = useNavigationRouting();
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();

  const issuePanel = createDetailPanel<IssueDetailPayload>();
  const prPanel = createDetailPanel<PullRequestDetailViewModel>();
  const discussionPanel = createDetailPanel<DiscussionDetailPayload>();
  const releasePanel = createDetailPanel<ReleaseDetailPayload>();
  const repoPanel = createDetailPanel<RepositoryDetailPayload>();

  const panels = [issuePanel, prPanel, discussionPanel, releasePanel, repoPanel];

  type DetailPanel = (typeof panels)[number];

  const showOnly = (panel: DetailPanel, except: DetailPanel[] = []) => {
    for (const other of panels) {
      if (other !== panel && !except.includes(other)) {
        other.visible.value = false;
      }
    }
    panel.visible.value = true;
  };

  const closeAllDetails = () => {
    for (const panel of panels) {
      panel.close();
    }
  };

  const hideDetailsForFileBrowsing = () => {
    for (const panel of panels) {
      if (panel === repoPanel) {
        panel.visible.value = false;
        continue;
      }

      panel.close();
    }
  };

  const isRepositoryDataForTarget = (
    repository: RepositoryDetailPayload | null,
    owner: string,
    repo: string
  ) => {
    if (!repository) return false;

    const repositoryOwner = repository.owner;
    const ownerLogin =
      repositoryOwner && typeof repositoryOwner === 'object' && 'login' in repositoryOwner
        ? String(repositoryOwner.login || '')
        : '';

    return ownerLogin === owner && repository.name === repo;
  };

  const buildDashboardQuery = (query: LocationQueryRaw) => {
    const nextQuery: LocationQueryRaw = {};

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        nextQuery[key] = value;
      }
    }

    return nextQuery;
  };

  const pushDashboardQuery = async (query: LocationQueryRaw) => {
    await router.push({
      path: localePath('/dashboard'),
      query: buildDashboardQuery(query),
    });
  };

  const replaceDashboardQuery = async (query: LocationQueryRaw) => {
    await router.replace({
      path: localePath('/dashboard'),
      query: buildDashboardQuery(query),
    });
  };

  const hasRouteQueryKey = (key: DashboardDetailQueryKey) => {
    return Object.hasOwn(route.query, key);
  };

  const hasConflictingDetailQuery = (preservedKeys: DashboardDetailQueryKey[]) => {
    const preservedKeySet = new Set(preservedKeys);
    return DASHBOARD_DETAIL_QUERY_KEYS.some(
      (key) => !preservedKeySet.has(key) && hasRouteQueryKey(key)
    );
  };

  const buildDetailDashboardQuery = (query: LocationQueryRaw) => {
    return {
      ...clearDashboardDetailQuery(route.query),
      tab: currentRouteTab.value,
      ...query,
    };
  };

  const pushDetailQuery = async (query: LocationQueryRaw) => {
    await pushDashboardQuery(buildDetailDashboardQuery(query));
  };

  const pushDetailRoute = async (detailType: DetailType, target: DetailTarget) => {
    await pushDetailQuery({
      [DETAIL_QUERY_KEY[detailType]]: serializeDashboardDetailTarget(
        target.owner,
        target.repo,
        target.number
      ),
    });
  };

  const pushReleaseDetailRoute = async (target: ReleaseDetailTarget) => {
    await pushDetailQuery(serializeReleaseQuery(target.owner, target.repo, target.releaseRef));
  };

  const activeIssueTarget = computed(() => parseDashboardDetailTarget(route.query.issue));
  const activePRTarget = computed(() => parseDashboardDetailTarget(route.query.pr));
  const activePRReviewTarget = computed(() => parseDashboardDetailTarget(route.query.prReview));
  const activeDiscussionTarget = computed(() => parseDashboardDetailTarget(route.query.discussion));
  const activeReleaseTarget = computed(() =>
    parseDashboardReleaseQuery(route.query.release, route.query.releaseTag)
  );
  const activeRepoTarget = computed(() => {
    const rawValue = getQueryParamValue(route.query.repo);
    if (!rawValue) return null;

    const repoPath = parseGitHubRepoPath(rawValue);
    if (!repoPath) return null;

    return {
      owner: repoPath.owner,
      repo: repoPath.repo,
    };
  });
  const activeRepoBranch = computed(() => getQueryParamValue(route.query.branch) || undefined);
  // Child pages under /dashboard/* (starred, releases, ...) own their view; detail
  // query keys there (e.g. `repo` on /dashboard/releases) must not drive the panels.
  const isDashboardChildRoute = computed(() => {
    return !route.path.replace(/\/$/, '').endsWith('/dashboard');
  });
  const isPRReviewRoute = computed(() => Boolean(activePRReviewTarget.value));
  const isFileBrowsingRoute = computed(() =>
    Boolean(activeRepoTarget.value && Object.hasOwn(route.query, 'path'))
  );

  const canonicalizeConflictingDetailRoute = async (
    issueTarget: DetailTarget | null,
    prTarget: DetailTarget | null,
    prReviewTarget: DetailTarget | null,
    discussionTarget: DetailTarget | null,
    releaseTarget: ReleaseDetailTarget | null
  ) => {
    // Helper to canonicalize a detail target if it has conflicts
    const canonicalizeIfConflict = async (
      target: DetailTarget | null,
      queryKeys: DashboardDetailQueryKey[],
      queryKey: DashboardDetailQueryKey
    ): Promise<boolean> => {
      if (!target || !hasConflictingDetailQuery(queryKeys)) {
        return false;
      }
      await replaceDashboardQuery(
        buildDetailDashboardQuery({
          [queryKey]: serializeDashboardDetailTarget(target.owner, target.repo, target.number),
        })
      );
      return true;
    };

    // Check each detail type in priority order
    if (await canonicalizeIfConflict(issueTarget, ['issue'], 'issue')) return true;
    if (await canonicalizeIfConflict(prReviewTarget, ['prReview'], 'prReview')) return true;
    if (await canonicalizeIfConflict(prTarget, ['pr'], 'pr')) return true;
    if (await canonicalizeIfConflict(discussionTarget, ['discussion'], 'discussion')) return true;

    if (releaseTarget && hasConflictingDetailQuery(['release', 'releaseTag'])) {
      await replaceDashboardQuery(
        buildDetailDashboardQuery(
          serializeReleaseQuery(releaseTarget.owner, releaseTarget.repo, releaseTarget.releaseRef)
        )
      );
      return true;
    }

    if (isFileBrowsingRoute.value && hasConflictingDetailQuery(['repo', 'path', 'branch'])) {
      const repoTarget = activeRepoTarget.value;
      if (repoTarget) {
        await replaceDashboardQuery({
          ...clearDashboardDetailQuery(route.query),
          repo: serializeDashboardRepoTarget(repoTarget.owner, repoTarget.repo),
          path: getQueryParamValue(route.query.path) ?? '',
          branch: activeRepoBranch.value,
        });
        return true;
      }
    }

    if (
      activeRepoTarget.value &&
      !isFileBrowsingRoute.value &&
      hasConflictingDetailQuery(['repo', 'branch'])
    ) {
      // Keep in-repo panel location when stripping a conflicting detail key so
      // Back still lands on the same section/page after canonicalization.
      await replaceDashboardQuery(
        buildDetailDashboardQuery({
          repo: serializeDashboardRepoTarget(
            activeRepoTarget.value.owner,
            activeRepoTarget.value.repo
          ),
          branch: activeRepoBranch.value,
          section: getQueryParamValue(route.query.section) || undefined,
          repoPage: getQueryParamValue(route.query.repoPage) || undefined,
          repoState: getQueryParamValue(route.query.repoState) || undefined,
        })
      );
      return true;
    }

    return false;
  };

  const issueDetailKey = computed(() => {
    const target = activeIssueTarget.value;
    return target ? `issue-${target.owner}-${target.repo}-${target.number}` : 'issue-empty';
  });

  const prDetailKey = computed(() => {
    const reviewTarget = activePRReviewTarget.value;
    if (reviewTarget) {
      return `pr-review-${reviewTarget.owner}-${reviewTarget.repo}-${reviewTarget.number}`;
    }
    const target = activePRTarget.value;
    return target ? `pr-${target.owner}-${target.repo}-${target.number}` : 'pr-empty';
  });

  const repoDetailKey = computed(() => {
    const target = activeRepoTarget.value;
    return target ? `repo-${target.owner}-${target.repo}` : 'repo-empty';
  });

  const discussionDetailKey = computed(() => {
    const target = activeDiscussionTarget.value;
    return target
      ? `discussion-${target.owner}-${target.repo}-${target.number}`
      : 'discussion-empty';
  });

  const releaseDetailKey = computed(() => {
    const target = activeReleaseTarget.value;
    return target
      ? `release-${target.owner}-${target.repo}-${target.releaseRef.kind}-${getReleaseRefValue(
          target.releaseRef
        )}`
      : 'release-empty';
  });

  const hasVisibleDetail = computed(() => {
    return (
      issuePanel.visible.value ||
      prPanel.visible.value ||
      discussionPanel.visible.value ||
      releasePanel.visible.value ||
      repoPanel.visible.value
    );
  });

  const currentDetailRefreshKey = computed(() => {
    if (activeIssueTarget.value) return issueDetailKey.value;
    if (activePRReviewTarget.value || activePRTarget.value) return prDetailKey.value;
    if (activeDiscussionTarget.value) return discussionDetailKey.value;
    if (activeReleaseTarget.value) return releaseDetailKey.value;
    if (activeRepoTarget.value && !isFileBrowsingRoute.value) return repoDetailKey.value;
    return 'detail-empty';
  });

  const currentDetailFreshnessUrl = computed(() => {
    const issueTarget = activeIssueTarget.value;
    if (issueTarget) {
      return `/api/issues/${issueTarget.owner}/${issueTarget.repo}/${issueTarget.number}/freshness`;
    }

    const pullTarget = activePRReviewTarget.value ?? activePRTarget.value;
    if (pullTarget) {
      return `/api/pulls/${pullTarget.owner}/${pullTarget.repo}/${pullTarget.number}/freshness`;
    }

    const releaseTarget = activeReleaseTarget.value;
    if (releaseTarget) {
      if (releaseTarget.releaseRef.kind === 'tag') {
        return `/api/releases/${releaseTarget.owner}/${releaseTarget.repo}/by-tag/freshness?tag=${encodeURIComponent(
          releaseTarget.releaseRef.tag
        )}`;
      }

      return `/api/releases/${releaseTarget.owner}/${releaseTarget.repo}/${releaseTarget.releaseRef.id}/freshness`;
    }

    const repoTarget = activeRepoTarget.value;
    if (repoTarget && !isFileBrowsingRoute.value) {
      return `/api/repos/${repoTarget.owner}/${repoTarget.repo}/freshness`;
    }

    return '';
  });

  const openIssue = async (issue: DashboardDetailListItem) => {
    const repoPath = parseGitHubRepoPath(issue.repository_url);
    if (!repoPath || !issue.number) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(createDashboardIssueTarget(repoPath.owner, repoPath.repo, issue.number));
      return;
    }

    await pushDetailRoute('issue', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: issue.number,
    });
  };

  const openPR = async (pull: DashboardDetailListItem) => {
    const repoPath = parseGitHubRepoPath(pull.repository_url);
    if (!repoPath || !pull.number) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(
        createDashboardPullRequestTarget(repoPath.owner, repoPath.repo, pull.number)
      );
      return;
    }

    await pushDetailRoute('pull-request', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: pull.number,
    });
  };

  const loadIssueData = async (owner: string, repo: string, issueNumber: number) => {
    if (!owner || !repo || !issueNumber) return;

    showOnly(issuePanel, [repoPanel]);
    await issuePanel.load(
      () => apiFetch<IssueDetailPayload>(`/api/issues/${owner}/${repo}/${issueNumber}`),
      {
        logPrefix: 'Error fetching issue:',
        fallbackError: t('detailOverlay.loadError.issue'),
      }
    );
  };

  const loadPRData = async (
    owner: string,
    repo: string,
    pullNumber: number,
    options: { force?: boolean } = {}
  ) => {
    if (!owner || !repo || !pullNumber) return;

    // Skip if already loaded for the same PR
    const currentData = prPanel.data.value;
    if (
      !options.force &&
      currentData &&
      currentData.base?.repo?.owner?.login === owner &&
      currentData.base?.repo?.name === repo &&
      currentData.number === pullNumber
    ) {
      return;
    }

    showOnly(prPanel, [repoPanel]);
    await prPanel.load(
      async () => {
        const pullRequest = await apiFetch<PullRequestDetailResponse>(
          `/api/pulls/${owner}/${repo}/${pullNumber}`
        );
        return createPullRequestDetailViewModel(pullRequest, { owner, repo });
      },
      {
        logPrefix: 'Error fetching pull request:',
        fallbackError: t('detailOverlay.loadError.pullRequest'),
      }
    );
  };

  const loadRepoData = async (owner: string, repo: string, options: { force?: boolean } = {}) => {
    if (!owner || !repo) return;

    if (!options.force && isRepositoryDataForTarget(repoPanel.data.value, owner, repo)) {
      showOnly(repoPanel);
      repoPanel.error.value = '';
      repoPanel.loading.value = false;
      return;
    }

    showOnly(repoPanel);
    await repoPanel.load(() => apiFetch<RepositoryDetailPayload>(`/api/repos/${owner}/${repo}`), {
      logPrefix: 'Error fetching repository:',
      fallbackError: t('detailOverlay.loadError.repository'),
    });
  };

  const loadDiscussionData = async (owner: string, repo: string, discussionNumber: number) => {
    if (!owner || !repo || !discussionNumber) return;

    showOnly(discussionPanel);
    await discussionPanel.load(
      () =>
        apiFetch<DiscussionDetailPayload>(`/api/discussions/${owner}/${repo}/${discussionNumber}`),
      {
        logPrefix: 'Error fetching discussion:',
        fallbackError: t('detailOverlay.loadError.discussion'),
      }
    );
  };

  const loadReleaseData = async (owner: string, repo: string, releaseRef: ReleaseDashboardRef) => {
    if (!owner || !repo) return;
    if (releaseRef.kind === 'id' && !releaseRef.id) return;
    if (releaseRef.kind === 'tag' && !releaseRef.tag) return;

    showOnly(releasePanel);
    await releasePanel.load(
      () => {
        const releaseUrl =
          releaseRef.kind === 'tag'
            ? `/api/releases/${owner}/${repo}/by-tag?tag=${encodeURIComponent(releaseRef.tag)}`
            : `/api/releases/${owner}/${repo}/${releaseRef.id}`;
        return apiFetch<ReleaseDetailPayload>(releaseUrl);
      },
      {
        logPrefix: 'Error fetching release:',
        fallbackError: t('detailOverlay.loadError.release'),
      }
    );
  };

  const handleSwitchIssue = async (owner: string, repo: string, issueNumber: number) => {
    if (!owner || !repo || !issueNumber) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(createDashboardIssueTarget(owner, repo, issueNumber));
      return;
    }

    await pushDetailRoute('issue', { owner, repo, number: issueNumber });
  };

  const handleSwitchPR = async (owner: string, repo: string, pullNumber: number) => {
    if (!owner || !repo || !pullNumber) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(createDashboardPullRequestTarget(owner, repo, pullNumber));
      return;
    }

    await pushDetailRoute('pull-request', { owner, repo, number: pullNumber });
  };

  const handleSwitchDiscussion = async (owner: string, repo: string, discussionNumber: number) => {
    if (!owner || !repo || !discussionNumber) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(createDashboardDiscussionTarget(owner, repo, discussionNumber));
      return;
    }

    await pushDetailRoute('discussion', { owner, repo, number: discussionNumber });
  };

  const handleSwitchRelease = async (owner: string, repo: string, releaseId: number) => {
    if (!owner || !repo || !releaseId) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(createDashboardReleaseTarget(owner, repo, { kind: 'id', id: releaseId }));
      return;
    }

    await pushReleaseDetailRoute({
      owner,
      repo,
      releaseRef: {
        kind: 'id',
        id: releaseId,
      },
    });
  };

  const handlePRReviewOpen = async () => {
    const target = activePRTarget.value;
    if (!target) return;

    if (opensGitHubLinks.value) {
      openGitHubTarget(
        createDashboardPullRequestReviewTarget(target.owner, target.repo, target.number)
      );
      return;
    }

    // Mirror handlePRReviewClose's query shape (keep the residual query as-is,
    // swap pr for prReview) so the review entry collapses back onto the exact
    // pull-request entry on close, even for tab-less deep links.
    await pushDashboardQuery({
      ...route.query,
      pr: undefined,
      prReview: serializeDashboardDetailTarget(target.owner, target.repo, target.number),
      url: undefined,
    });
  };

  const handlePRReviewClose = async () => {
    const target = activePRReviewTarget.value;

    await pushDashboardQuery({
      ...route.query,
      pr: target
        ? serializeDashboardDetailTarget(target.owner, target.repo, target.number)
        : undefined,
      prReview: undefined,
      url: undefined,
    });
  };

  const openNotification = (notification: DashboardNotification) => {
    if (opensGitHubLinks.value) {
      openExternalNotification(notification);
      return;
    }

    const details = getNotificationDetails(notification);

    if (!details) {
      openExternalNotification(notification);
      return;
    }

    if (details.isIssue) {
      void handleSwitchIssue(details.owner, details.repo, details.number);
      return;
    }

    if (details.isDiscussion) {
      void handleSwitchDiscussion(details.owner, details.repo, details.number);
      return;
    }

    if (details.isRelease) {
      void handleSwitchRelease(details.owner, details.repo, details.number);
      return;
    }

    void handleSwitchPR(details.owner, details.repo, details.number);
  };

  const refreshCurrentDetail = async () => {
    const issueTarget = activeIssueTarget.value;
    if (issueTarget) {
      await loadIssueData(issueTarget.owner, issueTarget.repo, issueTarget.number);
      return;
    }

    const pullTarget = activePRReviewTarget.value ?? activePRTarget.value;
    if (pullTarget) {
      await loadPRData(pullTarget.owner, pullTarget.repo, pullTarget.number, { force: true });
      return;
    }

    const discussionTarget = activeDiscussionTarget.value;
    if (discussionTarget) {
      await loadDiscussionData(
        discussionTarget.owner,
        discussionTarget.repo,
        discussionTarget.number
      );
      return;
    }

    const releaseTarget = activeReleaseTarget.value;
    if (releaseTarget) {
      await loadReleaseData(releaseTarget.owner, releaseTarget.repo, releaseTarget.releaseRef);
      return;
    }

    const repoTarget = activeRepoTarget.value;
    if (repoTarget && !isFileBrowsingRoute.value) {
      await loadRepoData(repoTarget.owner, repoTarget.repo, { force: true });
    }
  };

  const handleDetailBack = async () => {
    await goBackToPreviousPage();
  };

  const handleDetailHome = async () => {
    await goToDashboardHome();
  };

  watch(
    () => [
      route.query.issue,
      route.query.pr,
      route.query.prReview,
      route.query.discussion,
      route.query.release,
      route.query.releaseTag,
      route.query.repo,
      route.query.path,
      route.query.branch,
      isDashboardChildRoute.value,
      sessionReady.value,
      loggedIn.value,
    ],
    async () => {
      if (import.meta.server) {
        return;
      }

      if (!sessionReady.value) {
        return;
      }

      if (!loggedIn.value) {
        closeAllDetails();
        return;
      }

      if (isDashboardChildRoute.value) {
        closeAllDetails();
        return;
      }

      const issueTarget = activeIssueTarget.value;
      const prTarget = activePRTarget.value;
      const prReviewTarget = activePRReviewTarget.value;
      const discussionTarget = activeDiscussionTarget.value;
      const releaseTarget = activeReleaseTarget.value;

      if (
        await canonicalizeConflictingDetailRoute(
          issueTarget,
          prTarget,
          prReviewTarget,
          discussionTarget,
          releaseTarget
        )
      ) {
        return;
      }

      if (isFileBrowsingRoute.value) {
        hideDetailsForFileBrowsing();
        return;
      }

      if (issueTarget) {
        await loadIssueData(issueTarget.owner, issueTarget.repo, issueTarget.number);
        return;
      }

      if (prReviewTarget) {
        await loadPRData(prReviewTarget.owner, prReviewTarget.repo, prReviewTarget.number);
        return;
      }

      if (prTarget) {
        await loadPRData(prTarget.owner, prTarget.repo, prTarget.number);
        return;
      }

      if (discussionTarget) {
        await loadDiscussionData(
          discussionTarget.owner,
          discussionTarget.repo,
          discussionTarget.number
        );
        return;
      }

      if (releaseTarget) {
        await loadReleaseData(releaseTarget.owner, releaseTarget.repo, releaseTarget.releaseRef);
        return;
      }

      if (activeRepoTarget.value) {
        const { owner, repo } = activeRepoTarget.value;
        await loadRepoData(owner, repo);
        return;
      }

      closeAllDetails();
    },
    { immediate: true }
  );

  return {
    currentIssue: issuePanel.data,
    currentPR: prPanel.data,
    currentDiscussion: discussionPanel.data,
    currentRelease: releasePanel.data,
    currentRepo: repoPanel.data,
    issueError: issuePanel.error,
    prError: prPanel.error,
    discussionError: discussionPanel.error,
    releaseError: releasePanel.error,
    repoError: repoPanel.error,
    isIssueDetailVisible: issuePanel.visible,
    isPRDetailVisible: prPanel.visible,
    isDiscussionDetailVisible: discussionPanel.visible,
    isReleaseDetailVisible: releasePanel.visible,
    isRepoDetailVisible: repoPanel.visible,
    issueDetailKey,
    discussionDetailKey,
    releaseDetailKey,
    loadingIssue: issuePanel.loading,
    loadingPR: prPanel.loading,
    loadingDiscussion: discussionPanel.loading,
    loadingRelease: releasePanel.loading,
    loadingRepo: repoPanel.loading,
    prDetailKey,
    repoDetailKey,
    hasVisibleDetail,
    currentDetailRefreshKey,
    currentDetailFreshnessUrl,
    refreshCurrentDetail,
    openIssue,
    openNotification,
    openPR,
    handleDetailBack,
    handleDetailHome,
    handleSwitchIssue,
    handleSwitchPR,
    handleSwitchDiscussion,
    handleSwitchRelease,
    handlePRReviewOpen,
    handlePRReviewClose,
    isPRReviewRoute,
  };
}
