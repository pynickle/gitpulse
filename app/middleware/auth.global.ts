import { normalizeAuthReturnTo } from '#shared/utils/auth-return-route';

function isNativeLoginPage(path: string) {
  return path === '/native-login' || path.endsWith('/native-login');
}

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  const localePath = useLocalePath();
  const landingPath = localePath('/');

  if (!loggedIn.value && to.path !== landingPath && !isNativeLoginPage(to.path)) {
    const returnTo = normalizeAuthReturnTo(to.fullPath);

    return navigateTo({
      path: landingPath,
      ...(returnTo ? { query: { returnTo } } : {}),
    });
  }
});
