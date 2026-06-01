import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

interface DashboardEntity {
  repository_url?: string | null;
  number?: number | null;
  [key: string]: unknown;
}

interface DashboardNotification {
  subject?: {
    type?: string;
    url?: string;
  };
  html_url?: string;
}

type DetailType = 'issue' | 'pull-request';

interface DetailTarget {
  owner: string;
  repo: string;
  number: number;
}

export function useDashboardDetails(currentRouteTab: Ref<string>) {
  const apiFetch = useGitPulseApiFetch();
  const { getNotificationDetails, openExternalNotification } = useUrlHelper();
  const { goBack, goToHome, hasHistory, navigateToIssue, navigateToPullRequest, navigateToRepo } =
    useNavigationHistory();
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
    if (segments.length < 3) return null;

    const numberSegment = segments[segments.length - 1];
    const repo = segments[segments.length - 2];
    const owner = segments.slice(0, -2).join('/');
    const number = Number.parseInt(numberSegment ?? '', 10);

    if (!owner || !repo || !Number.isFinite(number)) return null;

    return { owner, repo, number };
  };

  const serializeDetailTarget = (owner: string, repo: string, number: number) => {
    return `${owner}/${repo}/${number}`;
  };

  const serializeRepoTarget = (owner: string, repo: string) => {
    return `${owner}/${repo}`;
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
    };

    await pushDashboardQuery(query);
  };

  const pushRepoDetailRoute = async (owner: string, repo: string) => {
    await pushDashboardQuery({
      ...route.query,
      tab: currentRouteTab.value,
      issue: undefined,
      pr: undefined,
      repo: serializeRepoTarget(owner, repo),
    });
  };

  const clearDetailRoute = async () => {
    await pushDashboardQuery({
      ...route.query,
      issue: undefined,
      pr: undefined,
      repo: undefined,
      tab: currentRouteTab.value,
    });
  };

  const activeIssueTarget = computed(() => parseDetailTarget(route.query.issue));
  const activePRTarget = computed(() => parseDetailTarget(route.query.pr));
  const activeRepoTarget = computed(() => {
    const rawValue = getQueryParamValue(route.query.repo);
    if (!rawValue) return null;

    const segments = rawValue.split('/').filter(Boolean);
    if (segments.length < 2) return null;

    const repo = segments[segments.length - 1];
    const owner = segments.slice(0, -1).join('/');
    if (!owner || !repo) return null;

    return { owner, repo };
  });

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

    navigateToIssue(repoPath.owner, repoPath.repo, issue.number);
    await pushDetailRoute('issue', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: issue.number,
    });
  };

  const openPR = async (pull: DashboardEntity) => {
    const repoPath = parseGitHubRepoPath(pull.repository_url);
    if (!repoPath || !pull.number) return;

    navigateToPullRequest(repoPath.owner, repoPath.repo, pull.number);
    await pushDetailRoute('pull-request', {
      owner: repoPath.owner,
      repo: repoPath.repo,
      number: pull.number,
    });
  };

  const openRepo = async (repo: DashboardEntity) => {
    const repoPath = parseGitHubRepoPath(repo.repository_url);
    if (!repoPath) return;

    navigateToRepo(repoPath.owner, repoPath.repo);
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
        currentRepo.value = repository as Record<string, unknown>;
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
    navigateToIssue(owner, repo, issueNumber);
    await pushDetailRoute('issue', target);
  };

  const handleSwitchPR = async (owner: string, repo: string, pullNumber: number) => {
    if (!owner || !repo || !pullNumber) return;

    const target = { owner, repo, number: pullNumber };
    navigateToPullRequest(owner, repo, pullNumber);
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

    if (!previousEntry) {
      await clearDetailRoute();
      return;
    }

    if (hasHistory.value) {
      router.back();
      return;
    }

    await clearDetailRoute();
  };

  const handleIssueDetailBack = async () => {
    await restorePreviousEntry();
  };

  const handlePRDetailBack = async () => {
    await restorePreviousEntry();
  };

  const handleRepoDetailBack = async () => {
    await restorePreviousEntry();
  };

  const handleIssueDetailHome = async () => {
    goToHome();
    await clearDetailRoute();
  };

  const handlePRDetailHome = async () => {
    goToHome();
    await clearDetailRoute();
  };

  const handleRepoDetailHome = async () => {
    goToHome();
    await clearDetailRoute();
  };

  watch(
    () => [route.query.issue, route.query.pr, route.query.repo],
    async () => {
      const issueTarget = activeIssueTarget.value;
      const prTarget = activePRTarget.value;

      if (issueTarget) {
        await loadIssueData(issueTarget.owner, issueTarget.repo, issueTarget.number);
        return;
      }

      if (prTarget) {
        await loadPRData(prTarget.owner, prTarget.repo, prTarget.number);
        return;
      }

      if (activeRepoTarget.value) {
        await loadRepoData(activeRepoTarget.value.owner, activeRepoTarget.value.repo);
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
