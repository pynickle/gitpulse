import { normalizeAuthReturnTo } from '#shared/utils/auth-return-route';
import { isPublicSurfacePath } from '#shared/utils/route-admission';

export default defineNuxtRouteMiddleware((to) => {
  // An unmatched path is a 404. Redirecting here writes the 302 before the
  // router can show the error page, so the landing page is returned as 200.
  if (to.matched.length === 0 || isPublicSurfacePath(to.path)) return;

  const { loggedIn } = useUserSession();
  if (loggedIn.value) return;

  const localePath = useLocalePath();
  const returnTo = normalizeAuthReturnTo(to.fullPath);

  return navigateTo({
    path: localePath('/'),
    ...(returnTo ? { query: { returnTo } } : {}),
  });
});
