import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import type { DashboardNotification } from '#shared/types/notifications';
import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

interface DashboardEntity {
  repository_url?: string | null;
  number?: number | null;
  [key: string]: unknown;
}

type DetailType = 'issue' | 'pull-request';

interface DetailTarget {
  owner: string;
  repo: string;
  number: number;
}

export function useDashboardDetails(currentRouteTab: Ref<string>) {
  const apiFetch = useGitPulseApiFetch();
  const { loggedIn, ready: sessionReady } = useUserSession();
  const { getNotificationDetails, openExternalNotification } = useUrlHelper();
  const {
    goBack,
    goToHome,
    navigateToIssue,
    navigateToPullRequest,
    navigateToRepo,
    replaceWithEntry,
    currentEntry,
  } = useNavigationHistory();
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();

  const isIssueDetailVisible = ref(false);
  const isPRDetailVisible = ref(false);
  const isRepoDetailVisible = ref(false);
  const currentIssue = ref<DashboardEntity | null>(null);
  const currentPR = ref<DashboardEntity | null>(null);
  const currentRepo = ref<Record<string, unknown> | null>(null);
  const issueError = ref('');
  const repoError = ref('');
  const loadingIssue = ref(false);
  const loadingPR = ref(false);
  const loadingRepo = ref(false);
  const issueRequestId = ref(0);
  const prRequestId = ref(0);
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

  const serializeDetailTarget = (owner: string, repo: string, number: number) => {
    return `${owner}/${repo}/${number}`;
  };

  const serializeRepoTarget = (owner: string, repo: string) => {
    return `${owner}/${repo}`;
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

  const navigateToEntryRoute = async (entry: typeof currentEntry.value) => {
    if (!entry || entry.type === 'dashboard' || entry.type === 'notification') {
      await clearDetailRoute();
      return;
    }

    const data = entry.data;

    if (entry.type === 'issue' && data?.owner && data.repo && data.number) {
      await pushDashboardQuery({
        ...route.query,
        tab: data.tab ?? currentRouteTab.value,
        issue: serializeDetailTarget(data.owner, data.repo, data.number),
        pr: undefined,
        repo: undefined,
        path: undefined,
        branch: undefined,
      });
      return;
    }

    if (entry.type === 'pull-request' && data?.owner && data.repo && data.number) {
      await pushDashboardQuery({
        ...route.query,
        tab: data.tab ?? currentRouteTab.value,
        issue: undefined,
        pr: serializeDetailTarget(data.owner, data.repo, data.number),
        repo: undefined,
        path: undefined,
        branch: undefined,
      });
      return;
    }

    if (entry.type === 'repository' && data?.owner && data.repo) {
      await pushRepoDetailRoute(data.owner, data.repo, data.branch);
      return;
    }

    if (entry.type === 'file' && data?.owner && data.repo) {
      await pushDashboardQuery({
        ...route.query,
        repo: `${data.owner}/${data.repo}`,
        path: data.path ?? '',
        branch: data.branch,
        issue: undefined,
        pr: undefined,
      });
      return;
    }

    await clearDetailRoute();
  };

  const pushDetailRoute = async (detailType: DetailType, target: DetailTarget) => {
    const query: LocationQueryRaw = {
      ...route.query,
      tab: currentRouteTab.value,
      issue:
        detailType === 'issue'
          ? serializeDetailTarget(target.owner, target.repo, target.number)
          : undefined,
      pr:
        detailType === 'pull-request'
          ? serializeDetailTarget(target.owner, target.repo, target.number)
          : undefined,
      repo: undefined,
      path: undefined,
      branch: undefined,
    };

    await pushDashboardQuery(query);
  };

  const pushRepoDetailRoute = async (owner: string, repo: string, branch?: string) => {
    await pushDashboardQuery({
      ...route.query,
      tab: currentRouteTab.value,
      issue: undefined,
      pr: undefined,
      repo: serializeRepoTarget(owner, repo),
      path: undefined,
      branch,
    });
  };

  const clearDetailRoute = async () => {
    await pushDashboardQuery({
      ...route.query,
      issue: undefined,
      pr: undefined,
      repo: undefined,
      path: undefined,
      branch: undefined,
      tab: currentRouteTab.value,
    });
  };

  const activeIssueTarget = computed(() => parseDetailTarget(route.query.issue));
  const activePRTarget = computed(() => parseDetailTarget(route.query.pr));
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
  const isFileBrowsingRoute = computed(() =>
    Boolean(activeRepoTarget.value && Object.hasOwn(route.query, 'path'))
  );

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
  const handleRepoDetailBack = handleIssueDetailBack;
  const handlePRDetailHome = handleIssueDetailHome;
  const handleRepoDetailHome = handleIssueDetailHome;

  watch(
    () => [
      route.query.issue,
      route.query.pr,
      route.query.repo,
      route.query.path,
      route.query.branch,
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
        closeRepoDetail();
        return;
      }

      const issueTarget = activeIssueTarget.value;
      const prTarget = activePRTarget.value;

      if (isFileBrowsingRoute.value) {
        closeIssueDetail();
        closePRDetail();
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
        if (
          currentEntry.value?.type !== 'pull-request' ||
          currentData?.owner !== prTarget.owner ||
          currentData?.repo !== prTarget.repo ||
          currentData?.number !== prTarget.number
        ) {
          replaceWithEntry({
            type: 'pull-request',
            data: {
              owner: prTarget.owner,
              repo: prTarget.repo,
              number: prTarget.number,
              tab: currentRouteTab.value,
            },
          });
        }
        await loadPRData(prTarget.owner, prTarget.repo, prTarget.number);
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
      closeRepoDetail();
    },
    { immediate: true }
  );

  return {
    currentIssue,
    currentPR,
    currentRepo,
    issueError,
    repoError,
    isIssueDetailVisible,
    isPRDetailVisible,
    isRepoDetailVisible,
    issueDetailKey,
    loadingIssue,
    loadingPR,
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
    handleRepoDetailBack,
    handleRepoDetailHome,
    handleSwitchIssue,
    handleSwitchPR,
  };
}
