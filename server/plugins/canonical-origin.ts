import { applyCanonicalOrigin, resolveCanonicalOrigin } from '#shared/utils/canonical-origin';

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.prerender) {
    return;
  }

  const origin = resolveCanonicalOrigin(process.env);
  if (!origin) {
    return;
  }

  // The shared runtime config is frozen. Each request gets its own copy, and
  // that copy is what locale alternates read.
  if (!useRuntimeConfig().public.i18n) {
    throw new Error(
      '[site] i18n runtime config is missing, so locale alternates cannot use the canonical origin.'
    );
  }

  nitroApp.hooks.hook('request', (event) => {
    applyCanonicalOrigin(useRuntimeConfig(event), origin);
  });
});
