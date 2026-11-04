export default defineNuxtRouteMiddleware((to) => {
  // An unmatched path is a 404 (docs/adr/0042-unknown-paths-and-discovery-documents.md):
  // only a page that actually matched can be canonicalised.
  if (to.matched.length === 0) return;

  // Filename order puts this after `auth.global.ts`, so a signed-out visitor is
  // sent to sign-in first and this redirect never stands in for the auth gate.
  if (isDashboardRouteShapeAdmissible(to)) return;

  const localePath = useLocalePath();
  const { path } = resolveNavigationEntryRoute({ type: 'dashboard' });

  return navigateTo({ path: localePath(path) });
});
