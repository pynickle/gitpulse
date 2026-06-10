import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import type { DiscussionDetailPayload } from '#shared/types/discussions';
import type { DashboardNotification } from '#shared/types/notifications';
import type { ReleaseDetailPayload } from '#shared/types/releases';
import {
  DASHBOARD_DETAIL_QUERY_KEYS,
  buildDashboardQueryFromNavigationEntry,
  clearDashboardDetailQuery,
  type DashboardDetailQueryKey,
  type PullRequestDashboardView,
  type ReleaseDashboardRef,
} from '~/utils/dashboard-url-navigation-utils';
import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

interface DashboardEntity {
  repository_url?: string | null;
  number?: number | null;
  [key: string]: unknown;
}

type DetailType = 'issue' | 'pull-request' | 'discussion' | 'release';

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

const parsePullRequestView = (value: unknown): PullRequestDashboardView | undefined => {
  return getQueryParamValue(value) === 'diff' ? 'diff' : undefined;
};

const getReleaseRefValue = (releaseRef: ReleaseDashboardRef | undefined) => {
  if (!releaseRef) return undefined;
  return releaseRef.kind === 'id' ? releaseRef.id : releaseRef.tag;
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
    navigateToRelease,
    navigateToRepo,
    replaceWithEntry,
    currentEntry,
  } = useNavigationHistory();
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();

  const isIssueDetailVisible = ref(false);
  const isPRDetailVisible = ref(false);
  const isDiscussionDetailVisible = ref(false);
  const isReleaseDetailVisible = ref(false);
  const isRepoDetailVisible = ref(false);
  const currentIssue = ref<DashboardEntity | null>(null);
  const currentPR = ref<DashboardEntity | null>(null);
  const currentDiscussion = ref<DiscussionDetailPayload | null>(null);
  const currentRelease = ref<ReleaseDetailPayload | null>(null);
  const currentRepo = ref<Record<string, unknown> | null>(null);
  const issueError = ref('');
  const discussionError = ref('');
  const releaseError = ref('');
  const repoError = ref('');
  const loadingIssue = ref(false);
  const loadingPR = ref(false);
  const loadingDiscussion = ref(false);
  const loadingRelease = ref(false);
  const loadingRepo = ref(false);
  const issueRequestId = ref(0);
  const prRequestId = ref(0);
  const discussionRequestId = ref(0);
  const releaseRequestId = ref(0);
  const repoRequestId = ref(0);

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

  const serializeDetailTarget = (owner: string, repo: string, number: number) => {
    return `${owner}/${repo}/${number}`;
  };

  const serializeRepoTarget = (owner: string, repo: string) => {
    return `${owner}/${repo}`;
  };

  const buildReleaseQuery = (target: ReleaseDetailTarget) => {
    if (target.releaseRef.kind === 'tag') {
      return {
        release: serializeRepoTarget(target.owner, target.repo),
        releaseTag: target.releaseRef.tag,
      };
    }

    return {
      release: serializeDetailTarget(target.owner, target.repo, target.releaseRef.id),
    };
  };

  const getRepositoryDefaultBranch = (repository: Record<string, unknown> | null) => {
    return typeof repository?.default_branch === 'string' && repository.default_branch
      ? repository.default_branch
      : undefined;
  };

  const isRepositoryDataForTarget = (
    repository: Record<string, unknown> | null,
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

  const pushDetailRoute = async (detailType: DetailType, target: DetailTarget) => {
    const query = buildDetailDashboardQuery({
      issue:
        detailType === 'issue'
          ? serializeDetailTarget(target.owner, target.repo, target.number)
          : undefined,
      pr:
        detailType === 'pull-request'
          ? serializeDetailTarget(target.owner, target.repo, target.number)
          : undefined,
      discussion:
        detailType === 'discussion'
          ? serializeDetailTarget(target.owner, target.repo, target.number)
          : undefined,
    });

    await pushDashboardQuery(query);
  };

  const pushReleaseDetailRoute = async (target: ReleaseDetailTarget) => {
    await pushDashboardQuery(buildDetailDashboardQuery(buildReleaseQuery(target)));
  };

  const pushRepoDetailRoute = async (owner: string, repo: string, branch?: string) => {
    await pushDashboardQuery(
      buildDetailDashboardQuery({
        repo: serializeRepoTarget(owner, repo),
        branch,
      })
    );
  };

  const clearDetailRoute = async () => {
    await pushDashboardQuery({
      ...clearDashboardDetailQuery(route.query),
      tab: currentRouteTab.value,
    });
  };

  const activeIssueTarget = computed(() => parseDetailTarget(route.query.issue));
  const activePRTarget = computed(() => parseDetailTarget(route.query.pr));
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
  const activePRView = computed(() => parsePullRequestView(route.query.prView));
  const isPRReviewRoute = computed(() => activePRView.value === 'diff');
  const isFileBrowsingRoute = computed(() =>
    Boolean(activeRepoTarget.value && Object.hasOwn(route.query, 'path'))
  );

  const canonicalizeConflictingDetailRoute = async (
    issueTarget: DetailTarget | null,
    prTarget: DetailTarget | null,
    discussionTarget: DetailTarget | null,
    releaseTarget: ReleaseDetailTarget | null
  ) => {
    if (issueTarget && hasConflictingDetailQuery(['issue'])) {
      await replaceDashboardQuery(
        buildDetailDashboardQuery({
          issue: serializeDetailTarget(issueTarget.owner, issueTarget.repo, issueTarget.number),
        })
      );
      return true;
    }

    if (prTarget && hasConflictingDetailQuery(['pr', 'prView'])) {
      await replaceDashboardQuery(
        buildDetailDashboardQuery({
          pr: serializeDetailTarget(prTarget.owner, prTarget.repo, prTarget.number),
          prView: activePRView.value,
        })
      );
      return true;
    }

    if (discussionTarget && hasConflictingDetailQuery(['discussion'])) {
      await replaceDashboardQuery(
        buildDetailDashboardQuery({
          discussion: serializeDetailTarget(
            discussionTarget.owner,
            discussionTarget.repo,
            discussionTarget.number
          ),
        })
      );
      return true;
    }

    if (releaseTarget && hasConflictingDetailQuery(['release', 'releaseTag'])) {
      await replaceDashboardQuery(buildDetailDashboardQuery(buildReleaseQuery(releaseTarget)));
      return true;
    }

    if (isFileBrowsingRoute.value && hasConflictingDetailQuery(['repo', 'path', 'branch'])) {
      const repoTarget = activeRepoTarget.value;
      if (repoTarget) {
        await replaceDashboardQuery({
          ...clearDashboardDetailQuery(route.query),
          repo: serializeRepoTarget(repoTarget.owner, repoTarget.repo),
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
          repo: serializeRepoTarget(activeRepoTarget.value.owner, activeRepoTarget.value.repo),
          branch: activeRepoBranch.value,
        })
      );
      return true;
    }

    return false;
  };

  const getCanonicalRepoBranch = (owner: string, repo: string) => {
    if (activeRepoBranch.value) return activeRepoBranch.value;

    const currentDefaultBranch = isRepositoryDataForTarget(currentRepo.value, owner, repo)
      ? getRepositoryDefaultBranch(currentRepo.value)
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

  const closeIssueDetail = () => {
    issueRequestId.value += 1;
    isIssueDetailVisible.value = false;
    currentIssue.value = null;
    issueError.value = '';
    loadingIssue.value = false;
  };

  const closePRDetail = () => {
    prRequestId.value += 1;
    isPRDetailVisible.value = false;
    currentPR.value = null;
    loadingPR.value = false;
  };

  const closeDiscussionDetail = () => {
    discussionRequestId.value += 1;
    isDiscussionDetailVisible.value = false;
    currentDiscussion.value = null;
    discussionError.value = '';
    loadingDiscussion.value = false;
  };

  const closeReleaseDetail = () => {
    releaseRequestId.value += 1;
    isReleaseDetailVisible.value = false;
    currentRelease.value = null;
    releaseError.value = '';
    loadingRelease.value = false;
  };

  const closeRepoDetail = () => {
    repoRequestId.value += 1;
    isRepoDetailVisible.value = false;
    currentRepo.value = null;
    repoError.value = '';
    loadingRepo.value = false;
  };

  const openIssue = async (issue: DashboardEntity) => {
    const repoPath = parseGitHubRepoPath(issue.repository_url);
    if (!repoPath || !issue.number) return;

    navigateToIssue(repoPath.owner, repoPath.repo, issue.number, currentRouteTab.value);
    await pushDetailRoute('issue', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: issue.number,
    });
  };

  const openPR = async (pull: DashboardEntity) => {
    const repoPath = parseGitHubRepoPath(pull.repository_url);
    if (!repoPath || !pull.number) return;

    navigateToPullRequest(repoPath.owner, repoPath.repo, pull.number, currentRouteTab.value);
    await pushDetailRoute('pull-request', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: pull.number,
    });
  };

  const openRepo = async (repo: DashboardEntity) => {
    const repoPath = parseGitHubRepoPath(repo.repository_url);
    if (!repoPath) return;

    navigateToRepo(repoPath.owner, repoPath.repo, currentRouteTab.value);
    await pushRepoDetailRoute(repoPath.owner, repoPath.repo);
  };

  const loadIssueData = async (owner: string, repo: string, issueNumber: number) => {
    if (!owner || !repo || !issueNumber) return;

    const requestId = issueRequestId.value + 1;
    issueRequestId.value = requestId;
    currentIssue.value = null;
    issueError.value = '';
    loadingIssue.value = true;
    isPRDetailVisible.value = false;
    isDiscussionDetailVisible.value = false;
    isReleaseDetailVisible.value = false;
    isIssueDetailVisible.value = true;

    await nextTick();

    try {
      const issue = await apiFetch<DashboardEntity>(`/api/issues/${owner}/${repo}/${issueNumber}`);
      if (requestId === issueRequestId.value) {
        currentIssue.value = issue;
      }
    } catch (error) {
      console.error('Error fetching issue:', error);
      if (requestId === issueRequestId.value) {
        issueError.value = error instanceof Error ? error.message : 'Failed to load issue details.';
      }
    } finally {
      if (requestId === issueRequestId.value) {
        loadingIssue.value = false;
      }
    }
  };

  const loadPRData = async (owner: string, repo: string, pullNumber: number) => {
    if (!owner || !repo || !pullNumber) return;

    const repositoryUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const requestId = prRequestId.value + 1;
    prRequestId.value = requestId;
    currentPR.value = null;
    loadingPR.value = true;
    isIssueDetailVisible.value = false;
    isDiscussionDetailVisible.value = false;
    isReleaseDetailVisible.value = false;
    isPRDetailVisible.value = true;

    await nextTick();

    try {
      const pullRequest = await apiFetch(`/api/pulls/${owner}/${repo}/${pullNumber}`);
      if (requestId === prRequestId.value) {
        currentPR.value = {
          repository_url: repositoryUrl,
          ...((pullRequest as Record<string, unknown>) || {}),
        };
      }
    } catch (error) {
      console.error('Error fetching pull request:', error);
    } finally {
      if (requestId === prRequestId.value) {
        loadingPR.value = false;
      }
    }
  };

  const loadRepoData = async (owner: string, repo: string) => {
    if (!owner || !repo) return;

    const requestId = repoRequestId.value + 1;
    repoRequestId.value = requestId;
    currentRepo.value = null;
    repoError.value = '';
    loadingRepo.value = true;
    isIssueDetailVisible.value = false;
    isPRDetailVisible.value = false;
    isDiscussionDetailVisible.value = false;
    isReleaseDetailVisible.value = false;
    isRepoDetailVisible.value = true;

    await nextTick();

    try {
      const repository = await apiFetch(`/api/repos/${owner}/${repo}`);
      if (requestId === repoRequestId.value) {
        const repoData = repository as Record<string, unknown>;
        currentRepo.value = repoData;
        syncRepositoryEntry(
          owner,
          repo,
          activeRepoBranch.value ?? getRepositoryDefaultBranch(repoData)
        );
      }
    } catch (error) {
      console.error('Error fetching repository:', error);
      if (requestId === repoRequestId.value) {
        repoError.value =
          error instanceof Error ? error.message : 'Failed to load repository details.';
      }
    } finally {
      if (requestId === repoRequestId.value) {
        loadingRepo.value = false;
      }
    }
  };

  const loadDiscussionData = async (owner: string, repo: string, discussionNumber: number) => {
    if (!owner || !repo || !discussionNumber) return;

    const requestId = discussionRequestId.value + 1;
    discussionRequestId.value = requestId;
    currentDiscussion.value = null;
    discussionError.value = '';
    loadingDiscussion.value = true;
    isIssueDetailVisible.value = false;
    isPRDetailVisible.value = false;
    isReleaseDetailVisible.value = false;
    isRepoDetailVisible.value = false;
    isDiscussionDetailVisible.value = true;

    await nextTick();

    try {
      const discussion = await apiFetch<DiscussionDetailPayload>(
        `/api/discussions/${owner}/${repo}/${discussionNumber}`
      );
      if (requestId === discussionRequestId.value) {
        currentDiscussion.value = discussion;
      }
    } catch (error) {
      console.error('Error fetching discussion:', error);
      if (requestId === discussionRequestId.value) {
        discussionError.value =
          error instanceof Error ? error.message : 'Failed to load discussion details.';
      }
    } finally {
      if (requestId === discussionRequestId.value) {
        loadingDiscussion.value = false;
      }
    }
  };

  const loadReleaseData = async (owner: string, repo: string, releaseRef: ReleaseDashboardRef) => {
    if (!owner || !repo) return;
    if (releaseRef.kind === 'id' && !releaseRef.id) return;
    if (releaseRef.kind === 'tag' && !releaseRef.tag) return;

    const requestId = releaseRequestId.value + 1;
    releaseRequestId.value = requestId;
    currentRelease.value = null;
    releaseError.value = '';
    loadingRelease.value = true;
    isIssueDetailVisible.value = false;
    isPRDetailVisible.value = false;
    isDiscussionDetailVisible.value = false;
    isRepoDetailVisible.value = false;
    isReleaseDetailVisible.value = true;

    await nextTick();

    try {
      const releaseUrl =
        releaseRef.kind === 'tag'
          ? `/api/releases/${owner}/${repo}/by-tag?tag=${encodeURIComponent(releaseRef.tag)}`
          : `/api/releases/${owner}/${repo}/${releaseRef.id}`;
      const release = await apiFetch<ReleaseDetailPayload>(releaseUrl);
      if (requestId === releaseRequestId.value) {
        currentRelease.value = release;
      }
    } catch (error) {
      console.error('Error fetching release:', error);
      if (requestId === releaseRequestId.value) {
        releaseError.value =
          error instanceof Error ? error.message : 'Failed to load release details.';
      }
    } finally {
      if (requestId === releaseRequestId.value) {
        loadingRelease.value = false;
      }
    }
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

    navigateToPullRequest(target.owner, target.repo, target.number, currentRouteTab.value, 'diff');

    await pushDashboardQuery(
      buildDetailDashboardQuery({
        pr: serializeDetailTarget(target.owner, target.repo, target.number),
        prView: 'diff',
      })
    );
  };

  const handlePRReviewClose = async () => {
    const target = activePRTarget.value;

    if (target && currentEntry.value?.type === 'pull-request') {
      currentEntry.value = {
        type: 'pull-request',
        data: {
          owner: target.owner,
          repo: target.repo,
          number: target.number,
          tab: currentRouteTab.value,
        },
      };
    }

    await pushDashboardQuery({
      ...route.query,
      prView: undefined,
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

  const restorePreviousEntry = async () => {
    const previousEntry = goBack();
    await navigateToEntryRoute(previousEntry);
  };

  const handleIssueDetailBack = async () => {
    await restorePreviousEntry();
  };

  const handleIssueDetailHome = async () => {
    goToHome();
    await clearDetailRoute();
  };

  const handlePRDetailBack = handleIssueDetailBack;
  const handleDiscussionDetailBack = handleIssueDetailBack;
  const handleReleaseDetailBack = handleIssueDetailBack;
  const handleRepoDetailBack = handleIssueDetailBack;
  const handlePRDetailHome = handleIssueDetailHome;
  const handleDiscussionDetailHome = handleIssueDetailHome;
  const handleReleaseDetailHome = handleIssueDetailHome;
  const handleRepoDetailHome = handleIssueDetailHome;

  watch(
    () => [
      route.query.issue,
      route.query.pr,
      route.query.discussion,
      route.query.release,
      route.query.releaseTag,
      route.query.repo,
      route.query.path,
      route.query.branch,
      route.query.prView,
      sessionReady.value,
      loggedIn.value,
    ],
    async () => {
      if (!import.meta.client) {
        return;
      }

      if (!sessionReady.value) {
        return;
      }

      if (!loggedIn.value) {
        closeIssueDetail();
        closePRDetail();
        closeDiscussionDetail();
        closeReleaseDetail();
        closeRepoDetail();
        return;
      }

      const issueTarget = activeIssueTarget.value;
      const prTarget = activePRTarget.value;
      const discussionTarget = activeDiscussionTarget.value;
      const releaseTarget = activeReleaseTarget.value;

      if (
        await canonicalizeConflictingDetailRoute(
          issueTarget,
          prTarget,
          discussionTarget,
          releaseTarget
        )
      ) {
        return;
      }

      if (isFileBrowsingRoute.value) {
        closeIssueDetail();
        closePRDetail();
        closeDiscussionDetail();
        closeReleaseDetail();
        closeRepoDetail();
        return;
      }

      if (issueTarget) {
        const currentData = currentEntry.value?.data;
        if (
          currentEntry.value?.type !== 'issue' ||
          currentData?.owner !== issueTarget.owner ||
          currentData?.repo !== issueTarget.repo ||
          currentData?.number !== issueTarget.number
        ) {
          replaceWithEntry({
            type: 'issue',
            data: {
              owner: issueTarget.owner,
              repo: issueTarget.repo,
              number: issueTarget.number,
              tab: currentRouteTab.value,
            },
          });
        }
        await loadIssueData(issueTarget.owner, issueTarget.repo, issueTarget.number);
        return;
      }

      if (prTarget) {
        const currentData = currentEntry.value?.data;
        const prView = activePRView.value;
        if (
          currentEntry.value?.type !== 'pull-request' ||
          currentData?.owner !== prTarget.owner ||
          currentData?.repo !== prTarget.repo ||
          currentData?.number !== prTarget.number ||
          currentData?.view !== prView
        ) {
          replaceWithEntry({
            type: 'pull-request',
            data: {
              owner: prTarget.owner,
              repo: prTarget.repo,
              number: prTarget.number,
              tab: currentRouteTab.value,
              view: prView,
            },
          });
        }
        await loadPRData(prTarget.owner, prTarget.repo, prTarget.number);
        return;
      }

      if (discussionTarget) {
        const currentData = currentEntry.value?.data;
        if (
          currentEntry.value?.type !== 'discussion' ||
          currentData?.owner !== discussionTarget.owner ||
          currentData?.repo !== discussionTarget.repo ||
          currentData?.number !== discussionTarget.number
        ) {
          replaceWithEntry({
            type: 'discussion',
            data: {
              owner: discussionTarget.owner,
              repo: discussionTarget.repo,
              number: discussionTarget.number,
              tab: currentRouteTab.value,
            },
          });
        }
        await loadDiscussionData(
          discussionTarget.owner,
          discussionTarget.repo,
          discussionTarget.number
        );
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

      closeIssueDetail();
      closePRDetail();
      closeDiscussionDetail();
      closeReleaseDetail();
      closeRepoDetail();
    },
    { immediate: true }
  );

  return {
    currentIssue,
    currentPR,
    currentDiscussion,
    currentRelease,
    currentRepo,
    issueError,
    discussionError,
    releaseError,
    repoError,
    isIssueDetailVisible,
    isPRDetailVisible,
    isDiscussionDetailVisible,
    isReleaseDetailVisible,
    isRepoDetailVisible,
    issueDetailKey,
    discussionDetailKey,
    releaseDetailKey,
    loadingIssue,
    loadingPR,
    loadingDiscussion,
    loadingRelease,
    loadingRepo,
    prDetailKey,
    repoDetailKey,
    openIssue,
    openNotification,
    openPR,
    handleIssueDetailBack,
    handleIssueDetailHome,
    handlePRDetailBack,
    handlePRDetailHome,
    handleDiscussionDetailBack,
    handleDiscussionDetailHome,
    handleReleaseDetailBack,
    handleReleaseDetailHome,
    handleRepoDetailBack,
    handleRepoDetailHome,
    handleSwitchIssue,
    handleSwitchPR,
    handleSwitchDiscussion,
    handleSwitchRelease,
    handlePRReviewOpen,
    handlePRReviewClose,
    isPRReviewRoute,
  };
}
