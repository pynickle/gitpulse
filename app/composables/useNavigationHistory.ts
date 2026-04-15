import { ref, computed } from 'vue';

type PageType = 'dashboard' | 'issue' | 'pull-request' | 'notification';

interface NavigationEntry {
  type: PageType;
  data?: {
    owner?: string;
    repo?: string;
    number?: number;
    tab?: string;
  };
}

const navigationHistory = ref<NavigationEntry[]>([]);
const currentEntry = ref<NavigationEntry | null>(null);

export function useNavigationHistory() {
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
    const prev = previousEntry.value;
    return prev?.type !== 'dashboard';
  });

  const pushEntry = (entry: NavigationEntry) => {
    if (currentEntry.value) {
      navigationHistory.value.push(currentEntry.value);
    } else {
      navigationHistory.value.push({
        type: 'dashboard',
      });
    }
    currentEntry.value = entry;
  };

  const navigateToDashboard = (tab?: string) => {
    const entry: NavigationEntry = {
      type: 'dashboard',
      data: { tab },
    };
    pushEntry(entry);
  };

  const navigateToIssue = (owner: string, repo: string, number: number) => {
    const entry: NavigationEntry = {
      type: 'issue',
      data: { owner, repo, number },
    };
    pushEntry(entry);
  };

  const navigateToPullRequest = (owner: string, repo: string, number: number) => {
    const entry: NavigationEntry = {
      type: 'pull-request',
      data: { owner, repo, number },
    };
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
    pushEntry,
    navigateToDashboard,
    navigateToIssue,
    navigateToPullRequest,
    navigateToNotification,
    goBack,
    goToHome,
    reset,
  };
}
