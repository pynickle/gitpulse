// https://nuxt.com/docs/api/configuration/nuxt-config
const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);

function normalizeBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;

  return defaultValue;
}

const patEnabled = normalizeBoolean(process.env.AUTH_PAT_ENABLED, true);
const oauthRequested = normalizeBoolean(process.env.AUTH_GITHUB_OAUTH_ENABLED, false);
const oauthEnvReady = Boolean(
  process.env.NUXT_OAUTH_GITHUB_CLIENT_ID && process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET
);
const effectiveOAuthEnabled = oauthRequested && oauthEnvReady;
const personalModeEnabled = normalizeBoolean(process.env.AUTH_PERSONAL_MODE_ENABLED, false);

if (!personalModeEnabled && !patEnabled && !oauthRequested) {
  throw new Error(
    'GitPulse auth configuration is invalid: both PAT token input and GitHub OAuth are disabled. Enable AUTH_PAT_ENABLED or AUTH_GITHUB_OAUTH_ENABLED before starting the app.'
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
      patEnabled: String(personalModeEnabled ? false : patEnabled),
      githubOAuthEnabled: String(personalModeEnabled ? false : effectiveOAuthEnabled),
      githubOAuthRequested: String(personalModeEnabled ? false : oauthRequested),
      githubOAuthEnvReady: String(oauthEnvReady),
      personalPat: '',
      personalPassword: '',
      personalCookieSecret: '',
    },
  },

  css: ['bulma/css/bulma.min.css', '~/assets/scss/main.scss'],

  nitro: {
    preset: 'bun',
    minify: true,
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'simplebar-vue',
        'lucide-vue-next',
        'vue3-simple-icons',
        'dayjs/locale/zh-cn', // CJS
        'dayjs', // CJS
        'dayjs/plugin/duration.js', // CJS
        'dayjs/plugin/relativeTime.js', // CJS
        'dayjs/plugin/relativeTime', // CJS
        'isomorphic-dompurify',
      ]
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
  },

  modules: ['@nuxtjs/i18n', '@nuxt/image', 'nuxt-auth-utils', '@nuxtjs/mdc'],

  mdc: {
    headings: {
      anchorLinks: {
        h1: false,
        h2: false,
        h3: false,
        h4: false,
        h5: false,
        h6: false,
      },
    },
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
