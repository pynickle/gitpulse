import type { ResolvedNavigationEntryRoute } from '../utils/navigationEntryRouting';

/**
 * The single Back/Home adapter for detail overlays and dashboard child pages.
 * Stack + intent live in Logical Navigation; this composable only localizes
 * the target and asks vue-router to navigate.
 */
export function useNavigationRouting() {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();
  const { applyEvent, canGoBack, currentEntry, previousEntry, shouldShowHomeButton } =
    useNavigationHistory();

  const navigateToTarget = async (target: ResolvedNavigationEntryRoute | null) => {
    if (!target) return;

    const localized = { path: localePath(target.path), query: target.query };
    if (router.resolve(localized).fullPath === route.fullPath) {
      applyEvent({ type: 'cancel-intent' });
      return;
    }

    await router.push(localized);
  };

  const goBackToPreviousPage = async () => {
    await navigateToTarget(applyEvent({ type: 'back', route }).target);
  };

  const goToDashboardHome = async () => {
    await navigateToTarget(applyEvent({ type: 'home', route }).target);
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
