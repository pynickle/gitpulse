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
  buildDashboardQueryFromNavigationEntry,
  clearDashboardDetailQuery,
  serializeDashboardDetailTarget,
  serializeDashboardRepoTarget,
  serializeReleaseQuery,
  type DashboardDetailQueryKey,
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

interface DetailTarget {
  owner: string;
  repo: string;
  number: number;
}

interface ReleaseDetailTarget {
  owner: string;
  repo: string;
  releaseRef: ReleaseDashboardRef;
}

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
        error.value = fetchError instanceof Error ? fetchError.message : options.fallbackError;
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
  const apiFetch = useGitPulseApiFetch();
  const { loggedIn, ready: sessionReady } = useUserSession();
  const { getNotificationDetails, openExternalNotification } = useUrlHelper();
  const {
    goBack,
    goToHome,
    navigateToDiscussion,
    navigateToIssue,
    navigateToPullRequest,
    navigateToPullRequestReview,
    navigateToRelease,
    replaceWithEntry,
    currentEntry,
  } = useNavigationHistory();
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

  const parseDetailTarget = (value: unknown): DetailTarget | null => {
    const rawValue = getQueryParamValue(value);
    if (!rawValue) return null;

    const segments = rawValue.split('/').filter(Boolean);
    if (segments.length !== 3) return null;

    const [owner, repo, numberSegment] = segments;

    if (!numberSegment || !/^\d+$/.test(numberSegment)) {
      return null;
    }

    const number = Number.parseInt(numberSegment, 10);

    if (!owner || !repo || !Number.isSafeInteger(number) || number < 1) return null;

    return { owner, repo, number };
  };

  const parseReleaseTarget = (releaseValue: unknown, releaseTagValue: unknown) => {
    const releaseTag = getQueryParamValue(releaseTagValue);
    if (releaseTag) {
      const rawRelease = getQueryParamValue(releaseValue);
      if (!rawRelease) return null;

      const repoPath = parseGitHubRepoPath(rawRelease);
      if (!repoPath) return null;

      return {
        owner: repoPath.owner,
        repo: repoPath.repo,
        releaseRef: {
          kind: 'tag' as const,
          tag: releaseTag,
        },
      };
    }

    const releaseIdTarget = parseDetailTarget(releaseValue);
    if (!releaseIdTarget) return null;

    return {
      owner: releaseIdTarget.owner,
      repo: releaseIdTarget.repo,
      releaseRef: {
        kind: 'id' as const,
        id: releaseIdTarget.number,
      },
    };
  };

  const getRepositoryDefaultBranch = (repository: RepositoryDetailPayload | null) => {
    return typeof repository?.default_branch === 'string' && repository.default_branch
      ? repository.default_branch
      : undefined;
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

  const navigateToEntryRoute = async (entry: typeof currentEntry.value) => {
    if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
      await clearDetailRoute();
      return;
    }

    const query = buildDashboardQueryFromNavigationEntry(entry, {
      defaultTab: currentRouteTab.value,
      repositoryTab: currentRouteTab.value,
    });

    if (query) {
      await pushDashboardQuery({
        ...clearDashboardDetailQuery(route.query),
        ...query,
      });
      return;
    }

    await clearDetailRoute();
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

  const clearDetailRoute = async () => {
    await pushDashboardQuery({
      ...clearDashboardDetailQuery(route.query),
      tab: currentRouteTab.value,
    });
  };

  const activeIssueTarget = computed(() => parseDetailTarget(route.query.issue));
  const activePRTarget = computed(() => parseDetailTarget(route.query.pr));
  const activePRReviewTarget = computed(() => parseDetailTarget(route.query.prReview));
  const activeDiscussionTarget = computed(() => parseDetailTarget(route.query.discussion));
  const activeReleaseTarget = computed(() =>
    parseReleaseTarget(route.query.release, route.query.releaseTag)
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
      await replaceDashboardQuery(
        buildDetailDashboardQuery({
          repo: serializeDashboardRepoTarget(
            activeRepoTarget.value.owner,
            activeRepoTarget.value.repo
          ),
          branch: activeRepoBranch.value,
        })
      );
      return true;
    }

    return false;
  };

  const getCanonicalRepoBranch = (owner: string, repo: string) => {
    if (activeRepoBranch.value) return activeRepoBranch.value;

    const currentDefaultBranch = isRepositoryDataForTarget(repoPanel.data.value, owner, repo)
      ? getRepositoryDefaultBranch(repoPanel.data.value)
      : undefined;
    if (currentDefaultBranch) return currentDefaultBranch;

    const currentData = currentEntry.value?.data;
    if (
      currentEntry.value?.type === 'repository' &&
      currentData?.owner === owner &&
      currentData.repo === repo &&
      currentData.branch
    ) {
      return currentData.branch;
    }

    return undefined;
  };

  const syncRepositoryEntry = (owner: string, repo: string, branch?: string) => {
    const currentData = currentEntry.value?.data;
    const nextEntry = {
      type: 'repository' as const,
      data: { owner, repo, tab: currentRouteTab.value, branch },
    };

    if (
      currentEntry.value?.type === 'repository' &&
      currentData?.owner === owner &&
      currentData.repo === repo &&
      currentData.branch === branch &&
      currentData.tab === currentRouteTab.value
    ) {
      return;
    }

    if (
      currentEntry.value?.type === 'repository' &&
      currentData?.owner === owner &&
      currentData.repo === repo
    ) {
      currentEntry.value = nextEntry;
      return;
    }

    replaceWithEntry(nextEntry);
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

    navigateToIssue(repoPath.owner, repoPath.repo, issue.number, currentRouteTab.value);
    await pushDetailRoute('issue', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: issue.number,
    });
  };

  const openPR = async (pull: DashboardDetailListItem) => {
    const repoPath = parseGitHubRepoPath(pull.repository_url);
    if (!repoPath || !pull.number) return;

    navigateToPullRequest(repoPath.owner, repoPath.repo, pull.number, currentRouteTab.value);
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
        fallbackError: 'Failed to load issue details.',
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
      { logPrefix: 'Error fetching pull request:' }
    );
  };

  const loadRepoData = async (owner: string, repo: string, options: { force?: boolean } = {}) => {
    if (!owner || !repo) return;

    if (!options.force && isRepositoryDataForTarget(repoPanel.data.value, owner, repo)) {
      showOnly(repoPanel);
      repoPanel.error.value = '';
      repoPanel.loading.value = false;
      syncRepositoryEntry(owner, repo, getCanonicalRepoBranch(owner, repo));
      return;
    }

    showOnly(repoPanel);
    await repoPanel.load(() => apiFetch<RepositoryDetailPayload>(`/api/repos/${owner}/${repo}`), {
      logPrefix: 'Error fetching repository:',
      fallbackError: 'Failed to load repository details.',
      onSuccess: (repoData) => {
        syncRepositoryEntry(
          owner,
          repo,
          activeRepoBranch.value ?? getRepositoryDefaultBranch(repoData)
        );
      },
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
        fallbackError: 'Failed to load discussion details.',
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
        fallbackError: 'Failed to load release details.',
      }
    );
  };

  const handleSwitchIssue = async (owner: string, repo: string, issueNumber: number) => {
    if (!owner || !repo || !issueNumber) return;

    const target = { owner, repo, number: issueNumber };
    navigateToIssue(owner, repo, issueNumber, currentRouteTab.value);
    await pushDetailRoute('issue', target);
  };

  const handleSwitchPR = async (owner: string, repo: string, pullNumber: number) => {
    if (!owner || !repo || !pullNumber) return;

    const target = { owner, repo, number: pullNumber };
    navigateToPullRequest(owner, repo, pullNumber, currentRouteTab.value);
    await pushDetailRoute('pull-request', target);
  };

  const handleSwitchDiscussion = async (owner: string, repo: string, discussionNumber: number) => {
    if (!owner || !repo || !discussionNumber) return;

    const target = { owner, repo, number: discussionNumber };
    navigateToDiscussion(owner, repo, discussionNumber, currentRouteTab.value);
    await pushDetailRoute('discussion', target);
  };

  const handleSwitchRelease = async (owner: string, repo: string, releaseId: number) => {
    if (!owner || !repo || !releaseId) return;

    const target = {
      owner,
      repo,
      releaseRef: {
        kind: 'id' as const,
        id: releaseId,
      },
    };
    navigateToRelease(owner, repo, target.releaseRef, currentRouteTab.value);
    await pushReleaseDetailRoute(target);
  };

  const handlePRReviewOpen = async () => {
    const target = activePRTarget.value;
    if (!target) return;

    navigateToPullRequestReview(target.owner, target.repo, target.number, currentRouteTab.value);

    await pushDashboardQuery(
      buildDetailDashboardQuery({
        prReview: serializeDashboardDetailTarget(target.owner, target.repo, target.number),
      })
    );
  };

  const handlePRReviewClose = async () => {
    const target = activePRReviewTarget.value;

    if (target && currentEntry.value?.type === 'pull-request-review') {
      replaceWithEntry({
        type: 'pull-request',
        data: {
          owner: target.owner,
          repo: target.repo,
          number: target.number,
          tab: currentRouteTab.value,
        },
      });
    }

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

  const restorePreviousEntry = async () => {
    const previousEntry = goBack();
    await navigateToEntryRoute(previousEntry);
  };

  const handleDetailBack = async () => {
    await restorePreviousEntry();
  };

  const handleDetailHome = async () => {
    goToHome();
    await clearDetailRoute();
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

      // Helper to ensure entry is set and load data if needed
      const ensureDetailEntry = (
        target: DetailTarget,
        type: 'issue' | 'pull-request' | 'pull-request-review' | 'discussion',
        loader: (owner: string, repo: string, number: number) => Promise<void>
      ) => {
        const currentData = currentEntry.value?.data;
        if (
          currentEntry.value?.type !== type ||
          currentData?.owner !== target.owner ||
          currentData?.repo !== target.repo ||
          currentData?.number !== target.number
        ) {
          replaceWithEntry({
            type,
            data: {
              owner: target.owner,
              repo: target.repo,
              number: target.number,
              tab: currentRouteTab.value,
            },
          });
        }
        return loader(target.owner, target.repo, target.number);
      };

      if (issueTarget) {
        await ensureDetailEntry(issueTarget, 'issue', loadIssueData);
        return;
      }

      if (prReviewTarget) {
        await ensureDetailEntry(prReviewTarget, 'pull-request-review', loadPRData);
        return;
      }

      if (prTarget) {
        await ensureDetailEntry(prTarget, 'pull-request', loadPRData);
        return;
      }

      if (discussionTarget) {
        await ensureDetailEntry(discussionTarget, 'discussion', loadDiscussionData);
        return;
      }

      if (releaseTarget) {
        const currentData = currentEntry.value?.data;
        if (
          currentEntry.value?.type !== 'release' ||
          currentData?.owner !== releaseTarget.owner ||
          currentData?.repo !== releaseTarget.repo ||
          currentData?.releaseRef?.kind !== releaseTarget.releaseRef.kind ||
          getReleaseRefValue(currentData?.releaseRef) !==
            getReleaseRefValue(releaseTarget.releaseRef)
        ) {
          replaceWithEntry({
            type: 'release',
            data: {
              owner: releaseTarget.owner,
              repo: releaseTarget.repo,
              number:
                releaseTarget.releaseRef.kind === 'id' ? releaseTarget.releaseRef.id : undefined,
              releaseRef: releaseTarget.releaseRef,
              tab: currentRouteTab.value,
            },
          });
        }
        await loadReleaseData(releaseTarget.owner, releaseTarget.repo, releaseTarget.releaseRef);
        return;
      }

      if (activeRepoTarget.value) {
        const { owner, repo } = activeRepoTarget.value;
        const currentData = currentEntry.value?.data;
        const branch = getCanonicalRepoBranch(owner, repo);
        if (
          currentEntry.value?.type !== 'repository' ||
          currentData?.owner !== owner ||
          currentData?.repo !== repo ||
          currentData?.branch !== branch
        ) {
          syncRepositoryEntry(owner, repo, branch);
        }
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
