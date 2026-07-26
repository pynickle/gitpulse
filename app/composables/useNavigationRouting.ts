import { clearDashboardDetailQuery } from '../utils/dashboardUrlNavigationUtils';
import { isDashboardRootPath, resolveNavigationEntryRoute } from '../utils/navigationEntryRouting';
import type { NavigationEntry, NavigationIntent } from './useNavigationHistory';

/**
 * The single Back/Home implementation for detail overlays and dashboard child
 * pages. Resolves popped entries through `resolveNavigationEntryRoute` and
 * marks the resulting navigation with an intent so the history plugin does not
 * treat it as a forward navigation.
 */
export function useNavigationRouting() {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();
  const {
    canGoBack,
    currentEntry,
    popEntry,
    previousEntry,
    resetToHome,
    setPendingIntent,
    shouldShowHomeButton,
  } = useNavigationHistory();

  const navigateToEntry = async (entry: NavigationEntry | null, intent: NavigationIntent) => {
    const resolved = resolveNavigationEntryRoute(entry, {
      // Back onto the dashboard keeps the residual query (tab, page, ...) the
      // detail URL carried, mirroring the legacy clearDetailRoute behavior.
      dashboardQuery: isDashboardRootPath(route.path)
        ? clearDashboardDetailQuery(route.query)
        : undefined,
    });

    const target = { path: localePath(resolved.path), query: resolved.query };

    // The stack is already adjusted; skip navigation when it would be a no-op.
    if (router.resolve(target).fullPath === route.fullPath) {
      return;
    }

    setPendingIntent(intent);
    await router.push(target);
  };

  const goBackToPreviousPage = async () => {
    await navigateToEntry(popEntry(), 'back');
  };

  const goToDashboardHome = async () => {
    resetToHome();
    await navigateToEntry({ type: 'dashboard' }, 'home');
  };

  return {
    canGoBack,
    currentEntry,
    previousEntry,
    shouldShowHomeButton,
    goBackToPreviousPage,
    goToDashboardHome,
  };
}
