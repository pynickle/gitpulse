// https://nuxt.com/docs/api/configuration/nuxt-config
const ENABLED_VALUES = new Set(['1', 'true']);
const DISABLED_VALUES = new Set(['0', 'false']);

function normalizeBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;

  return defaultValue;
}

const tokenEnabled = normalizeBoolean(process.env.NUXT_AUTH_PAT_ENABLED, true);
const oauthRequested = normalizeBoolean(process.env.NUXT_AUTH_GITHUB_OAUTH_ENABLED, true);
const oauthEnvReady = Boolean(
  process.env.NUXT_OAUTH_GITHUB_CLIENT_ID && process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET
);
const effectiveOAuthEnabled = oauthRequested && oauthEnvReady;
const personalModeEnabled = normalizeBoolean(process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED, true);

if (!personalModeEnabled && !tokenEnabled && !oauthRequested) {
  throw new Error(
    'GitPulse auth configuration is invalid: both token input and GitHub OAuth are disabled. Enable NUXT_AUTH_PAT_ENABLED or NUXT_AUTH_GITHUB_OAUTH_ENABLED before starting the app.'
  );
}

if (!personalModeEnabled && oauthRequested && !oauthEnvReady) {
  console.warn(
    '[auth] GitHub OAuth is enabled by configuration, but NUXT_OAUTH_GITHUB_CLIENT_ID or NUXT_OAUTH_GITHUB_CLIENT_SECRET is missing. OAuth has been disabled for this runtime.'
  );
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    gitPulseAuth: {
      personalModeEnabled: String(personalModeEnabled),
      tokenEnabled: String(personalModeEnabled ? false : tokenEnabled),
      githubOAuthEnabled: String(personalModeEnabled ? false : effectiveOAuthEnabled),
      githubOAuthRequested: String(personalModeEnabled ? false : oauthRequested),
      githubOAuthEnvReady: String(oauthEnvReady),
      githubToken: '',
      personalPassword: '',
      personalCookieSecret: '',
    },
  },

  css: ['bulma/css/bulma.min.css', '~/assets/scss/main.scss'],

  nitro: {
    minify: true,
  },

  vite: {
    optimizeDeps: {
      include: [
        '@comark/vue',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'comark',
        'comark/plugins/highlight',
        'comark/plugins/security',
        'dayjs', // CJS
        'dayjs/locale/zh-cn', // CJS
        'dayjs/plugin/duration.js', // CJS
        'dayjs/plugin/relativeTime', // CJS
        'dayjs/plugin/relativeTime.js', // CJS
        'lucide-vue-next',
        'mermaid',
        'simplebar-vue',
        'vue-draggable-plus',
        'vue3-simple-icons',
        'xss', // CJS
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          quietDeps: true,
          silenceDeprecations: ['if-function', 'global-builtin', 'import'],
        },
      },
    },
  },

  routeRules: {
    '/': { appLayout: 'landing' },
    '/**/dashboard': { appLayout: 'dashboard' },
    '/**/dashboard/**': { appLayout: 'dashboard' },
  },

  modules: ['@nuxtjs/i18n', '@nuxt/image', 'nuxt-auth-utils', '@comark/nuxt', '@nuxtjs/color-mode'],

  colorMode: {
    preference: 'system',
    fallback: 'light',
    classPrefix: '',
    classSuffix: '',
    dataValue: 'theme',
    storage: 'localStorage',
    storageKey: 'gitpulse-color-mode',
    disableTransition: true,
  },

  i18n: {
    locales: [
      {
        code: 'en',
        name: 'English',
        file: 'en.json',
      },
      {
        code: 'zh-cn',
        name: '中文',
        file: 'zh-cn.json',
      },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
  },
});
