import { computed } from 'vue';

import type { ReleaseDashboardRef } from '~/utils/dashboard-url-navigation-utils';

export type PageType =
  | 'dashboard'
  | 'issue'
  | 'pull-request'
  | 'pull-request-review'
  | 'discussion'
  | 'release'
  | 'repository'
  | 'notification'
  | 'file';

export interface NavigationEntry {
  type: PageType;
  data?: {
    owner?: string;
    repo?: string;
    number?: number;
    tab?: string;
    path?: string;
    branch?: string;
    releaseRef?: ReleaseDashboardRef;
  };
}

const getReleaseRefValue = (releaseRef: ReleaseDashboardRef | undefined) => {
  if (!releaseRef) return undefined;
  return releaseRef.kind === 'id' ? releaseRef.id : releaseRef.tag;
};

const isSameEntry = (left: NavigationEntry | null, right: NavigationEntry) => {
  return (
    left?.type === right.type &&
    left.data?.owner === right.data?.owner &&
    left.data?.repo === right.data?.repo &&
    left.data?.number === right.data?.number &&
    left.data?.tab === right.data?.tab &&
    left.data?.path === right.data?.path &&
    left.data?.branch === right.data?.branch &&
    left.data?.releaseRef?.kind === right.data?.releaseRef?.kind &&
    getReleaseRefValue(left.data?.releaseRef) === getReleaseRefValue(right.data?.releaseRef)
  );
};

export function useNavigationHistory() {
  const navigationHistory = useState<NavigationEntry[]>('gitpulse-navigation-history', () => []);
  const currentEntry = useState<NavigationEntry | null>('gitpulse-navigation-current', () => null);

  const hasHistory = computed(() => navigationHistory.value.length > 0);

  const previousEntry = computed(() => {
    if (navigationHistory.value.length > 0) {
      return navigationHistory.value[navigationHistory.value.length - 1];
    }
    return null;
  });

  const canGoBack = computed(() => hasHistory.value);

  const shouldShowHomeButton = computed(() => {
    if (!currentEntry.value) return false;
    if (!hasHistory.value) return false;
    return previousEntry.value?.type !== 'dashboard';
  });

  const pushEntry = (entry: NavigationEntry) => {
    if (isSameEntry(currentEntry.value, entry)) {
      currentEntry.value = entry;
      return;
    }

    if (currentEntry.value) {
      navigationHistory.value.push(currentEntry.value);
    } else {
      navigationHistory.value.push({
        type: 'dashboard',
      });
    }
    currentEntry.value = entry;
  };

  const replaceWithEntry = (entry: NavigationEntry) => {
    navigationHistory.value = [];
    currentEntry.value = entry;
  };

  const navigateToIssue = (owner: string, repo: string, number: number, tab?: string) => {
    const entry: NavigationEntry = {
      type: 'issue',
      data: { owner, repo, number, tab },
    };
    pushEntry(entry);
  };

  const navigateToPullRequest = (owner: string, repo: string, number: number, tab?: string) => {
    const entry: NavigationEntry = {
      type: 'pull-request',
      data: { owner, repo, number, tab },
    };
    pushEntry(entry);
  };

  const navigateToPullRequestReview = (
    owner: string,
    repo: string,
    number: number,
    tab?: string
  ) => {
    const entry: NavigationEntry = {
      type: 'pull-request-review',
      data: { owner, repo, number, tab },
    };
    pushEntry(entry);
  };

  const navigateToDiscussion = (owner: string, repo: string, number: number, tab?: string) => {
    const entry: NavigationEntry = {
      type: 'discussion',
      data: { owner, repo, number, tab },
    };
    pushEntry(entry);
  };

  const navigateToRelease = (
    owner: string,
    repo: string,
    releaseRef: ReleaseDashboardRef,
    tab?: string
  ) => {
    const entry: NavigationEntry = {
      type: 'release',
      data: {
        owner,
        repo,
        number: releaseRef.kind === 'id' ? releaseRef.id : undefined,
        releaseRef,
        tab,
      },
    };
    pushEntry(entry);
  };

  const navigateToRepo = (owner: string, repo: string, tab?: string, branch?: string) => {
    const entry: NavigationEntry = {
      type: 'repository',
      data: { owner, repo, tab, branch },
    };
    pushEntry(entry);
  };

  const navigateToFile = (owner: string, repo: string, path: string, branch?: string) => {
    const entry: NavigationEntry = {
      type: 'file',
      data: { owner, repo, path, branch },
    };

    if (currentEntry.value?.type === 'file') {
      currentEntry.value = entry;
      return;
    }

    pushEntry(entry);
  };

  const goBack = () => {
    if (navigationHistory.value.length === 0) {
      currentEntry.value = {
        type: 'dashboard',
      };
      return null;
    }

    const prev = navigationHistory.value.pop()!;
    currentEntry.value = prev;
    return prev;
  };

  const goToHome = () => {
    const homeEntry: NavigationEntry = {
      type: 'dashboard',
    };
    navigationHistory.value = [];
    currentEntry.value = homeEntry;
    return homeEntry;
  };

  return {
    navigationHistory,
    currentEntry,
    previousEntry,
    canGoBack,
    shouldShowHomeButton,
    replaceWithEntry,
    navigateToIssue,
    navigateToPullRequest,
    navigateToPullRequestReview,
    navigateToDiscussion,
    navigateToRelease,
    navigateToRepo,
    navigateToFile,
    goBack,
    goToHome,
  };
}
