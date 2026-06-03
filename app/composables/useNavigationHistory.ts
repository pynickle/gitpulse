import { computed } from 'vue';

export type PageType =
  | 'dashboard'
  | 'issue'
  | 'pull-request'
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
  };
}

const isSameEntry = (left: NavigationEntry | null, right: NavigationEntry) => {
  return (
    left?.type === right.type &&
    left.data?.owner === right.data?.owner &&
    left.data?.repo === right.data?.repo &&
    left.data?.number === right.data?.number &&
    left.data?.tab === right.data?.tab &&
    left.data?.path === right.data?.path &&
    left.data?.branch === right.data?.branch
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

  const navigateToDashboard = (tab?: string) => {
    const entry: NavigationEntry = {
      type: 'dashboard',
      data: { tab },
    };
    pushEntry(entry);
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

  const navigateToNotification = (tab?: string) => {
    const entry: NavigationEntry = {
      type: 'notification',
      data: { tab },
    };
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

  const cameFromIssueOrPR = computed(() => {
    return navigationHistory.value.some(
      (entry) => entry.type === 'issue' || entry.type === 'pull-request'
    );
  });

  const cameFromRepo = computed(() => {
    return navigationHistory.value.some((entry) => entry.type === 'repository');
  });

  const clearHistory = () => {
    navigationHistory.value = [];
  };

  const reset = () => {
    navigationHistory.value = [];
    currentEntry.value = null;
  };

  return {
    navigationHistory,
    currentEntry,
    previousEntry,
    hasHistory,
    canGoBack,
    shouldShowHomeButton,
    cameFromIssueOrPR,
    cameFromRepo,
    pushEntry,
    replaceWithEntry,
    navigateToDashboard,
    navigateToIssue,
    navigateToPullRequest,
    navigateToRepo,
    navigateToFile,
    navigateToNotification,
    goBack,
    goToHome,
    clearHistory,
    reset,
  };
}
