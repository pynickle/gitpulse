import { normalizeAuthReturnTo } from '#shared/utils/auth-return-route';

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  const localePath = useLocalePath();
  const landingPath = localePath('/');

  if (!loggedIn.value && to.path !== landingPath) {
    const returnTo = normalizeAuthReturnTo(to.fullPath);

    return navigateTo({
      path: landingPath,
      ...(returnTo ? { query: { returnTo } } : {}),
    });
  }
});
