import { computed } from 'vue';

import {
  DEFAULT_AUTH_RETURN_PATH,
  normalizeAuthReturnTo,
  withAppBase,
} from '#shared/utils/auth-return-route';

export function useAuthReturnNavigation() {
  const route = useRoute();
  const localePath = useLocalePath();
  const runtimeConfig = useRuntimeConfig();

  const returnTo = computed(() => normalizeAuthReturnTo(route.query.returnTo));
  const destination = computed(() => returnTo.value ?? localePath(DEFAULT_AUTH_RETURN_PATH));
  const oauthHref = computed(() => {
    const authPath = withAppBase('/auth/github', runtimeConfig.app.baseURL);
    const query = new URLSearchParams({ returnTo: destination.value });

    return `${authPath}?${query.toString()}`;
  });

  const continueToReturnTarget = () => navigateTo(destination.value);

  return {
    destination,
    oauthHref,
    continueToReturnTarget,
  };
}
