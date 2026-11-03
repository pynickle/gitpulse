import { computed } from 'vue';

import {
  DEFAULT_AUTH_RETURN_PATH,
  normalizeAuthReturnTo,
  withAppBase,
} from '#shared/utils/auth-return-route';
import { admitAuthReturnTo } from '#shared/utils/route-admission';

export function useAuthReturnNavigation() {
  const route = useRoute();
  const router = useRouter();
  const localePath = useLocalePath();
  const runtimeConfig = useRuntimeConfig();

  const returnTo = computed(() => normalizeAuthReturnTo(route.query.returnTo));
  const destination = computed(() =>
    admitAuthReturnTo(
      returnTo.value,
      (fullPath) => {
        const resolved = router.resolve(fullPath);
        return { matchedCount: resolved.matched.length, path: resolved.path };
      },
      localePath(DEFAULT_AUTH_RETURN_PATH)
    )
  );
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
