const buildFontVariableCss = (appFontFamily: string, codeFontFamily: string) => {
  return `:root{--gitpulse-app-font-family:${appFontFamily};--gitpulse-code-font-family:${codeFontFamily};}`;
};

export default defineNuxtPlugin(async () => {
  const { settings, loadSettings, appFontFamily, codeFontFamily } = useUserSettings();
  const { loggedIn } = useUserSession();

  if (import.meta.server && loggedIn.value) {
    await loadSettings();
  }

  useHead({
    style: [
      {
        key: 'gitpulse-user-font-settings',
        innerHTML: buildFontVariableCss(appFontFamily.value, codeFontFamily.value),
      },
    ],
  });

  if (import.meta.server) {
    return;
  }

  const applyFonts = () => {
    document.documentElement.style.setProperty('--gitpulse-app-font-family', appFontFamily.value);
    document.documentElement.style.setProperty('--gitpulse-code-font-family', codeFontFamily.value);
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
