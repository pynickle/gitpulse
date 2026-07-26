import type { RouteLocationNormalizedGeneric } from 'vue-router';

import { routeToNavigationEntry } from '~/utils/navigationEntryRouting';

/**
 * Derives the logical navigation history from router navigations, so every
 * route change — whatever triggered it — records correctly without manual
 * bookkeeping. Push/replace/browser-back are told apart via the `position`
 * counter vue-router persists in window.history.state.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter();
  const { applyRouteChange, consumePendingIntent } = useNavigationHistory();

  let lastPosition: number | null = null;

  const readPosition = () => {
    const position = window.history.state?.position;
    return typeof position === 'number' ? position : null;
  };

  const recordRoute = (
    to: RouteLocationNormalizedGeneric,
    options: { intent: boolean; initial: boolean }
  ) => {
    const entry = routeToNavigationEntry(to);
    const position = readPosition();

    if (entry === null) {
      // Outside the dashboard area the logical history has no meaning.
      applyRouteChange(null, { kind: 'reset' });
      lastPosition = position;
      return;
    }

    if (options.initial || lastPosition === null) {
      applyRouteChange(entry, { kind: options.initial ? 'reset' : 'replace' });
      lastPosition = position;
      return;
    }

    if (options.intent) {
      // Logical Back/Home already adjusted the stack; only sync the entry.
      applyRouteChange(entry, { kind: 'replace' });
      lastPosition = position;
      return;
    }

    const delta = position === null ? 1 : position - lastPosition;
    if (position !== null) {
      lastPosition = position;
    }

    if (delta < 0) {
      applyRouteChange(entry, { kind: 'pop', depth: -delta });
      return;
    }

    applyRouteChange(entry, { kind: delta === 0 ? 'replace' : 'push' });
  };

  router.afterEach((to, _from, failure) => {
    const intent = consumePendingIntent();

    if (failure) {
      return;
    }

    recordRoute(to, { intent: intent !== null, initial: lastPosition === null });
  });

  // Hard navigation errors (rejected middleware, failed chunk loads) never
  // reach afterEach; drop the intent so the next navigation records cleanly.
  router.onError(() => {
    consumePendingIntent();
  });

  // The initial navigation may already have settled before this plugin ran.
  recordRoute(router.currentRoute.value, { intent: false, initial: true });
});
