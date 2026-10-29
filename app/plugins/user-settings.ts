import { themePaletteStyleSheet } from '#shared/utils/theme-palette';

export default defineNuxtPlugin(async () => {
  const { loadSettings, appFontFamily, codeFontFamily, prReviewCodeFontSizePx } = useUserSettings();
  const { loggedIn } = useUserSession();

  useHead(() => ({
    htmlAttrs: {
      style: {
        '--gitpulse-app-font-family': appFontFamily.value,
        '--gitpulse-code-font-family': codeFontFamily.value,
        '--gitpulse-pr-review-code-font-size': prReviewCodeFontSizePx.value,
      },
    },
    // The Theme Preset's palette, from the data both clients share.
    style: [{ key: 'gitpulse-theme-palette', innerHTML: themePaletteStyleSheet }],
  }));

  if (import.meta.server && loggedIn.value) {
    await loadSettings();
  }

  if (import.meta.server) {
    return;
  }

  watch(
    loggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) {
        void loadSettings();
      }
    },
    { immediate: true }
  );
});
