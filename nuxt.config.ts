// https://nuxt.com/docs/api/configuration/nuxt-config
import { bundledFontFaces, bundledFontWeights } from './shared/utils/bundled-fonts';
import {
  defaultUserSettingsStorageBase,
  normalizeOptionalString,
  normalizeUserSettingsStorageDriver,
  resolveOptionalUpstashRedisCredentials,
} from './shared/utils/user-settings-storage-env';

const ENABLED_VALUES = new Set(['1', 'true']);
const DISABLED_VALUES = new Set(['0', 'false']);

type UserSettingsStorageConfig = {
  driver: string;
  base?: string;
  url?: string;
  token?: string;
};

type UserSettingsStorageAdapter = {
  defaultBase?: string;
  createConfig: (context: UserSettingsStorageContext) => UserSettingsStorageConfig;
};

type UserSettingsStorageContext = {
  driver: string;
  base?: string;
};

const DEFAULT_NITRO_USER_SETTINGS_STORAGE_DRIVER = 'fs';
const BASE_SCOPED_USER_SETTINGS_STORAGE_ADAPTERS: Record<string, UserSettingsStorageAdapter> = {
  fs: {
    createConfig: createBaseScopedUserSettingsStorageConfig,
  },
  upstash: {
    createConfig: createUpstashUserSettingsStorageConfig,
  },
};

const USER_SETTINGS_STORAGE_DRIVER = normalizeUserSettingsStorageDriver(
  process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_DRIVER
);
const USER_SETTINGS_STORAGE_BASE =
  normalizeOptionalString(process.env.NUXT_GITPULSE_USER_SETTINGS_STORAGE_BASE) ||
  defaultUserSettingsStorageBase(USER_SETTINGS_STORAGE_DRIVER);

function normalizeBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;

  return defaultValue;
}

function createBaseScopedUserSettingsStorageConfig(context: UserSettingsStorageContext) {
  return {
    driver: context.driver,
    ...(context.base ? { base: context.base } : {}),
  };
}

function createUpstashUserSettingsStorageConfig(context: UserSettingsStorageContext) {
  const credentials = resolveOptionalUpstashRedisCredentials(process.env);

  return {
    ...createBaseScopedUserSettingsStorageConfig(context),
    ...(credentials ? { url: credentials.url, token: credentials.token } : {}),
  };
}

function userSettingsStorageConfig() {
  const context = {
    driver: USER_SETTINGS_STORAGE_DRIVER,
    base: USER_SETTINGS_STORAGE_BASE,
  };

  if (context.driver === 'redis') {
    // Redis settings are handled by the server adapter; keep Nitro's mount local.
    return createBaseScopedUserSettingsStorageConfig({
      driver: DEFAULT_NITRO_USER_SETTINGS_STORAGE_DRIVER,
      base: defaultUserSettingsStorageBase(DEFAULT_NITRO_USER_SETTINGS_STORAGE_DRIVER),
    });
  }

  const adapter =
    BASE_SCOPED_USER_SETTINGS_STORAGE_ADAPTERS[context.driver] ??
    ({
      createConfig: createBaseScopedUserSettingsStorageConfig,
    } satisfies UserSettingsStorageAdapter);

  return adapter.createConfig(context);
}

const tokenEnabled = normalizeBoolean(process.env.NUXT_AUTH_PAT_ENABLED, true);
const oauthRequested = normalizeBoolean(process.env.NUXT_AUTH_GITHUB_OAUTH_ENABLED, true);
const oauthEnvReady = Boolean(
  process.env.NUXT_OAUTH_GITHUB_CLIENT_ID && process.env.NUXT_OAUTH_GITHUB_CLIENT_SECRET
);
const effectiveOAuthEnabled = oauthRequested && oauthEnvReady;
const personalModeEnabled = normalizeBoolean(process.env.NUXT_AUTH_PERSONAL_MODE_ENABLED, true);

function siteConfig() {
  return personalModeEnabled ? { indexable: false } : {};
}

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

  app: {
    head: {
      // Note: titleTemplate function is set in app.vue to prevent "GitPulse - GitPulse" on homepage
      title: 'GitPulse',
      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico',
        },
      ],
    },
  },
  ignore: [
    'extension/**',
    'extension/.output/**',
    'extension/.wxt/**',
    'extension/node_modules/**',
  ],

  runtimeConfig: {
    session: {
      password: '',
      cookie: {
        secure: process.env.NODE_ENV === 'production',
      },
    },
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
    storage: {
      userSettings: userSettingsStorageConfig(),
    },
    devStorage: {
      userSettings: userSettingsStorageConfig(),
    },
  },

  vite: {
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
    '/open': { appLayout: 'landing' },
    '/**/open': { appLayout: 'landing' },
    '/**/dashboard': { appLayout: 'dashboard' },
    '/**/dashboard/**': { appLayout: 'dashboard' },
  },

  site: {
    ...siteConfig(),
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://gitpulse.app',
    name: 'GitPulse',
    description:
      'Track GitHub notifications, issues, pull requests, and repositories from one focused workspace.',
    defaultLocale: 'en',
  },

  // Site-wide extras that nuxt-seo-utils does not infer from `site`.
  // description / og:site_name / og:type come from site config + module defaults.
  seo: {
    meta: {
      twitterCard: 'summary_large_image',
      themeColor: [
        { content: '#1f2937', media: '(prefers-color-scheme: dark)' },
        { content: '#ffffff', media: '(prefers-color-scheme: light)' },
      ],
    },
  },

  modules: [
    '@nuxtjs/i18n',
    'nuxt-site-config',
    '@nuxtjs/robots',
    'nuxt-seo-utils',
    '@nuxt/image',
    'nuxt-auth-utils',
    '@comark/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  fonts: {
    // Faces are explicit files, so no provider is set. v1 applies a provider to
    // every discovered family and fails the production build when that provider
    // does not ship it. Leave CSS variables unprocessed: the v1 default
    // (`font-prefixed-only`) would try to download `--gitpulse-*-font-family`,
    // whose stacks include system faces.
    processCSSVariables: false,
    defaults: {
      weights: [...bundledFontWeights],
      styles: ['normal'],
      subsets: ['latin'],
      preload: false,
    },
    families: bundledFontFaces,
  },

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

  robots: {
    disallow: ['/dashboard', '/dashboard/**', '/api/**', '/auth/**'],
  },

  i18n: {
    baseUrl: process.env.NUXT_SITE_URL,
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        file: 'en.json',
      },
      {
        code: 'zh-cn',
        language: 'zh-CN',
        name: '中文',
        file: 'zh-cn.json',
      },
    ],
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
  },

  experimental: {
    prefetchPreloadTags: true,
    routeTypedFetch: true,
  },
});
