import { assertAppSecretStrength } from '../utils/app-secret-utils';

export default defineNitroPlugin(() => {
  if (import.meta.prerender) {
    return;
  }

  assertAppSecretStrength(useRuntimeConfig().appSecret);
});
