/**
 * Browser/vue-router adapter for Logical Navigation. Each settled route
 * change is handed to the module as a (route, position) event; push,
 * replace, and browser-back are decided inside the module.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter();
  const { applyEvent } = useNavigationHistory();

  const readPosition = () => {
    const position = window.history.state?.position;
    return typeof position === 'number' ? position : null;
  };

  router.afterEach((to, _from, failure) => {
    applyEvent({
      type: 'route',
      route: to,
      position: readPosition(),
      failed: Boolean(failure),
    });
  });

  router.onError(() => {
    applyEvent({ type: 'cancel-intent' });
  });

  applyEvent({
    type: 'route',
    route: router.currentRoute.value,
    position: readPosition(),
  });
});
