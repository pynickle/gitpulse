import { createMemoryHistory, createRouter } from 'vue-router';

import type { ResolvedRoute } from './route-admission';

/** Matches a path against the build-time page table, including locale prefixes. */
export function createRouteMatcher(paths: readonly string[]): (fullPath: string) => ResolvedRoute {
  const unique = [...new Set(paths)].filter((path) => path.startsWith('/'));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...unique.map((path) => ({
        path,
        component: { render: () => null },
      })),
      // Keeps an unknown path from logging a missing-route warning. It is not a page.
      { path: '/:pathMatch(.*)*', name: 'unknown', component: { render: () => null } },
    ],
  });

  return (fullPath) => {
    const resolved = router.resolve(fullPath);
    const unknown = resolved.matched.some((record) => record.name === 'unknown');
    return {
      matchedCount: unknown ? 0 : resolved.matched.length,
      path: resolved.path,
    };
  };
}
