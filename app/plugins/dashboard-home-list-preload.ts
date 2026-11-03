export default defineNuxtPlugin(() => {
  const route = useRoute();
  const { user } = useUserSession();
  // Snapshot the cold-load document. Following the route would prefetch on client navigations.
  const hint = resolveDashboardHomeListPreload(
    { path: route.path, query: route.query },
    user.value?.login
  );

  if (!hint) return;

  useHead({ link: [hint] });
});
