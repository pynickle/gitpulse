export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession();
  const localePath = useLocalePath();
  const landingPath = localePath('/');

  if (!loggedIn.value && to.path !== landingPath) {
    return navigateTo(landingPath);
  }
});
