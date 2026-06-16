import { computed, ref, watch } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

import getQueryParamValue from '~/utils/getQueryParamValue';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

type RepoContentType = 'file' | 'dir' | 'symlink' | 'submodule';

interface RepoContentLinks {
  self: string;
  git: string;
  html: string;
}

export interface RepoContentItem {
  name: string;
  path: string;
  type: RepoContentType;
  size: number;
  sha: string;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  _links: RepoContentLinks;
}

export interface RepoFileContent extends RepoContentItem {
  type: 'file';
  content: string;
  encoding: 'base64';
}

export interface RepoBranch {
  name: string;
  sha: string;
  protected: boolean;
}

interface DefaultBranchResponse {
  default_branch: string;
}

interface RepoTarget {
  owner: string;
  repo: string;
}

type RepoContentsResponse = RepoContentItem[] | RepoFileContent | null;

const normalizePath = (path?: string) => {
  return (path || '').split('/').filter(Boolean).join('/');
};

const buildQuery = (query: LocationQueryRaw) => {
  const nextQuery: LocationQueryRaw = {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      nextQuery[key] = value;
    }
  }

  return nextQuery;
};

const buildBranchQueryValue = (branch: string, defaultBranch: string) => {
  return branch && branch !== defaultBranch ? branch : undefined;
};

const buildRepoKey = (owner: string, repo: string) => `${owner}/${repo}`;

const encodeContentPath = (path: string) => {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return '';

  return normalizedPath.split('/').map(encodeURIComponent).join('/');
};

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const statusCode = 'statusCode' in error ? error.statusCode : undefined;
  const status = 'status' in error ? error.status : undefined;

  return statusCode === 404 || status === 404;
};

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (isNotFoundError(error)) {
    return 'Repository file path was not found.';
  }

  return error instanceof Error && error.message ? error.message : fallback;
};

const getBranchNotFoundMessage = (branch: string) => {
  return branch ? `Branch "${branch}" was not found.` : 'Repository branch was not found.';
};

export function useRepoFiles() {
  const apiFetch = useGitPulseApiFetch();
  const { loggedIn, ready: sessionReady } = useUserSession();
  const route = useRoute();
  const router = useRouter();

  const currentPath = ref('');
  const currentBranch = ref('');
  const defaultBranch = ref('');
  const branches = ref<RepoBranch[]>([]);
  const directoryContents = ref<RepoContentItem[]>([]);
  const fileContent = ref<RepoFileContent | null>(null);
  const loading = ref(false);
  const error = ref('');
  const contentRequestId = ref(0);
  const repoRequestId = ref(0);
  const metadataRepoKey = ref('');
  const contentRepoKey = ref('');

  const activeRepoTarget = computed<RepoTarget | null>(() => {
    const rawValue = getQueryParamValue(route.query.repo);
    if (!rawValue) return null;

    const repoPath = parseGitHubRepoPath(rawValue);
    if (!repoPath) return null;

    return {
      owner: repoPath.owner,
      repo: repoPath.repo,
    };
  });

  const activePath = computed(() => normalizePath(getQueryParamValue(route.query.path)));
  const activeBranch = computed(() => getQueryParamValue(route.query.branch) || '');
  const hasActivePathQuery = computed(() => Object.hasOwn(route.query, 'path'));

  const isDirectory = computed(() => !fileContent.value);
  const isFile = computed(() => Boolean(fileContent.value));
  const currentRefreshKey = computed(() => {
    const target = activeRepoTarget.value;
    return [
      target?.owner ?? '',
      target?.repo ?? '',
      activePath.value,
      activeBranch.value || currentBranch.value || defaultBranch.value,
    ].join(':');
  });
  const currentFreshnessUrl = computed(() => {
    const target = activeRepoTarget.value;
    if (!target) {
      return '';
    }

    const searchParams = new URLSearchParams();
    if (activePath.value) {
      searchParams.set('path', activePath.value);
    }
    const branch = activeBranch.value || currentBranch.value || defaultBranch.value;
    if (branch) {
      searchParams.set('ref', branch);
    }

    const queryString = searchParams.toString();
    return `/api/repos/${target.owner}/${target.repo}/content-freshness${
      queryString ? `?${queryString}` : ''
    }`;
  });

  const clearState = () => {
    contentRequestId.value += 1;
    repoRequestId.value += 1;
    currentPath.value = '';
    currentBranch.value = '';
    defaultBranch.value = '';
    branches.value = [];
    directoryContents.value = [];
    fileContent.value = null;
    loading.value = false;
    error.value = '';
    metadataRepoKey.value = '';
    contentRepoKey.value = '';
  };

  const pushRepoFilesQuery = async (query: LocationQueryRaw) => {
    await router.push({
      query: buildQuery(query),
    });
  };

  const replaceRepoFilesQuery = async (query: LocationQueryRaw) => {
    await router.replace({
      query: buildQuery(query),
    });
  };

  const loadRepoMetadata = async (owner: string, repo: string) => {
    const repoKey = buildRepoKey(owner, repo);
    if (metadataRepoKey.value === repoKey && defaultBranch.value) {
      return defaultBranch.value;
    }

    const requestId = repoRequestId.value + 1;
    repoRequestId.value = requestId;

    try {
      const [defaultBranchResponse, branchResponse] = await Promise.all([
        apiFetch<DefaultBranchResponse>(`/api/repos/${owner}/${repo}/default-branch`),
        apiFetch<RepoBranch[]>(`/api/repos/${owner}/${repo}/branches`),
      ]);

      if (requestId !== repoRequestId.value) return null;

      defaultBranch.value = defaultBranchResponse.default_branch;
      branches.value = branchResponse;
      metadataRepoKey.value = repoKey;

      return defaultBranchResponse.default_branch;
    } catch (requestError) {
      console.error('Error fetching repository file metadata:', requestError);

      if (requestId === repoRequestId.value) {
        defaultBranch.value = '';
        branches.value = [];
        metadataRepoKey.value = '';
        error.value = getRequestErrorMessage(requestError, 'Failed to load repository branches.');
      }

      return null;
    }
  };

  const loadContent = async (owner: string, repo: string, path: string, branch: string) => {
    const requestId = contentRequestId.value + 1;
    contentRequestId.value = requestId;
    currentPath.value = path;
    currentBranch.value = branch;
    directoryContents.value = [];
    fileContent.value = null;
    error.value = '';
    loading.value = true;

    try {
      const encodedPath = encodeContentPath(path);
      const refQuery = branch ? `?ref=${encodeURIComponent(branch)}` : '';
      const basePath = `/api/repos/${owner}/${repo}/contents`;
      const fullPath = encodedPath ? `${basePath}/${encodedPath}` : basePath;
      const response = await apiFetch<RepoContentsResponse>(`${fullPath}${refQuery}`);

      if (requestId !== contentRequestId.value) return;

      if (Array.isArray(response)) {
        directoryContents.value = response;
        fileContent.value = null;
        contentRepoKey.value = buildRepoKey(owner, repo);
        return;
      }

      if (response) {
        directoryContents.value = [];
        fileContent.value = response;
        contentRepoKey.value = buildRepoKey(owner, repo);
        return;
      }

      directoryContents.value = [];
      fileContent.value = null;
      contentRepoKey.value = '';
      error.value = 'Repository file path was not found.';
    } catch (requestError) {
      console.error('Error fetching repository contents:', requestError);

      if (requestId === contentRequestId.value) {
        directoryContents.value = [];
        fileContent.value = null;
        contentRepoKey.value = '';
        error.value = getRequestErrorMessage(requestError, 'Failed to load repository contents.');
      }
    } finally {
      if (requestId === contentRequestId.value) {
        loading.value = false;
      }
    }
  };

  const hasLoadedContent = (target: RepoTarget, path: string, branch: string) => {
    return (
      contentRepoKey.value === buildRepoKey(target.owner, target.repo) &&
      currentPath.value === path &&
      currentBranch.value === branch &&
      !loading.value &&
      !error.value
    );
  };

  const canonicalizeDefaultBranchQuery = async (
    target: RepoTarget,
    path: string,
    branch: string,
    pathQueryWasPresent = hasActivePathQuery.value
  ) => {
    const canonicalizingTarget = { ...target };
    const canonicalizingPath = path;
    const canonicalizingBranch = branch;

    const currentTarget = activeRepoTarget.value;
    if (
      !currentTarget ||
      currentTarget.owner !== canonicalizingTarget.owner ||
      currentTarget.repo !== canonicalizingTarget.repo ||
      activePath.value !== canonicalizingPath ||
      activeBranch.value !== canonicalizingBranch ||
      hasActivePathQuery.value !== pathQueryWasPresent
    ) {
      return;
    }

    await replaceRepoFilesQuery({
      ...route.query,
      branch: undefined,
      path: pathQueryWasPresent ? path : undefined,
    });
  };

  const loadRepoFiles = async (target: RepoTarget, path: string, branch: string) => {
    error.value = '';
    if (metadataRepoKey.value !== buildRepoKey(target.owner, target.repo) || !defaultBranch.value) {
      loading.value = true;
    }

    const loadedDefaultBranch = await loadRepoMetadata(target.owner, target.repo);
    if (!loadedDefaultBranch) {
      loading.value = false;
      return;
    }

    if (branch && !branches.value.some((repoBranch) => repoBranch.name === branch)) {
      contentRequestId.value += 1;
      currentPath.value = path;
      currentBranch.value = branch;
      directoryContents.value = [];
      fileContent.value = null;
      error.value = getBranchNotFoundMessage(branch);
      loading.value = false;
      return;
    }

    const resolvedBranch = branch || loadedDefaultBranch;
    if (hasLoadedContent(target, path, resolvedBranch)) {
      loading.value = false;

      if (branch === loadedDefaultBranch) {
        await canonicalizeDefaultBranchQuery(target, path, branch);
      }

      return;
    }

    loading.value = true;

    if (branch === loadedDefaultBranch) {
      const pathQueryWasPresent = hasActivePathQuery.value;
      await loadContent(target.owner, target.repo, path, loadedDefaultBranch);
      await canonicalizeDefaultBranchQuery(target, path, branch, pathQueryWasPresent);
      return;
    }

    await loadContent(target.owner, target.repo, path, resolvedBranch);
  };

  const retry = async () => {
    const target = activeRepoTarget.value;
    if (!target) return;

    await loadRepoFiles(target, activePath.value, activeBranch.value || currentBranch.value);
  };

  const navigateToPath = async (path: string) => {
    await pushRepoFilesQuery({
      ...route.query,
      path: normalizePath(path),
      branch: buildBranchQueryValue(currentBranch.value, defaultBranch.value),
      view: undefined,
    });
  };

  const navigateToBranch = async (branch: string) => {
    await pushRepoFilesQuery({
      ...route.query,
      branch: buildBranchQueryValue(branch, defaultBranch.value),
      path: hasActivePathQuery.value ? currentPath.value : undefined,
    });
  };

  const navigateUp = async () => {
    const segments = currentPath.value.split('/').filter(Boolean);
    segments.pop();

    await navigateToPath(segments.join('/'));
  };

  const navigateToRoot = async () => {
    await navigateToPath('');
  };

  watch(
    () => [
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
        clearState();
        return;
      }

      const target = activeRepoTarget.value;
      if (!target) {
        clearState();
        return;
      }

      await loadRepoFiles(target, activePath.value, activeBranch.value);
    },
    { immediate: true }
  );

  return {
    currentPath,
    currentBranch,
    defaultBranch,
    branches,
    directoryContents,
    fileContent,
    loading,
    error,
    isDirectory,
    isFile,
    currentRefreshKey,
    currentFreshnessUrl,
    navigateToPath,
    navigateToBranch,
    navigateUp,
    navigateToRoot,
    retry,
  };
}
