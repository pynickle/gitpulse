const buildFontVariableCss = (
  appFontFamily: string,
  codeFontFamily: string,
  prReviewCodeFontSizePx: string
) => {
  return `:root{--gitpulse-app-font-family:${appFontFamily};--gitpulse-code-font-family:${codeFontFamily};--gitpulse-pr-review-code-font-size:${prReviewCodeFontSizePx};}`;
};

export default defineNuxtPlugin(async () => {
  const { settings, loadSettings, appFontFamily, codeFontFamily, prReviewCodeFontSizePx } =
    useUserSettings();
  const { loggedIn } = useUserSession();

  if (import.meta.server && loggedIn.value) {
    await loadSettings();
  }

  useHead({
    style: [
      {
        key: 'gitpulse-user-font-settings',
        innerHTML: buildFontVariableCss(
          appFontFamily.value,
          codeFontFamily.value,
          prReviewCodeFontSizePx.value
        ),
      },
    ],
  });

  if (import.meta.server) {
    return;
  }

  const applyFonts = () => {
    document.documentElement.style.setProperty('--gitpulse-app-font-family', appFontFamily.value);
    document.documentElement.style.setProperty('--gitpulse-code-font-family', codeFontFamily.value);
    document.documentElement.style.setProperty(
      '--gitpulse-pr-review-code-font-size',
      prReviewCodeFontSizePx.value
    );
  };

  watch(() => settings.value.fonts, applyFonts, { deep: true, immediate: true });
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
