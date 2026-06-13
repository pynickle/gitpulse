// https://nuxt.com/docs/api/configuration/nuxt-config
import {
  defaultUserSettingsStorageBase,
  normalizeOptionalString,
  normalizeUserSettingsStorageDriver,
  resolveOptionalUpstashRedisCredentials,
} from './shared/utils/user-settings-storage-env';

const ENABLED_VALUES = new Set(['1', 'true']);
const DISABLED_VALUES = new Set(['0', 'false']);
const FONT_WEIGHTS = [400, 500, 600, 700, 800] as const;

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

function fontsourceLatinFaces(options: {
  name: string;
  packageName: string;
  slug: string;
  version: string;
}) {
  return FONT_WEIGHTS.map((weight) => ({
    name: options.name,
    src: `https://cdn.jsdelivr.net/npm/${options.packageName}@${options.version}/files/${options.slug}-latin-${weight}-normal.woff2`,
    weight: String(weight),
    style: 'normal',
    preload: false,
    global: true,
  }));
}

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
      titleTemplate: '%s - GitPulse',
      title: 'GitPulse',
      meta: [
        {
          name: 'description',
          content:
            'Track GitHub notifications, issues, pull requests, and repositories from one focused workspace.',
        },
        { property: 'og:title', content: 'GitPulse' },
        {
          property: 'og:description',
          content:
            'Track GitHub notifications, issues, pull requests, and repositories from one focused workspace.',
        },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'GitPulse' },
        {
          name: 'twitter:description',
          content:
            'Track GitHub notifications, issues, pull requests, and repositories from one focused workspace.',
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
    optimizeDeps: {
      include: [
        '@comark/vue',
        '@shikijs/themes/github-dark',
        '@shikijs/themes/github-light',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'comark',
        'comark/plugins/highlight',
        'comark/plugins/security',
        'dayjs', // CJS
        'dayjs/locale/zh-cn', // CJS
        'dayjs/plugin/duration.js', // CJS
        'dayjs/plugin/relativeTime.js', // CJS
        'lucide-vue-next',
        'mermaid',
        'shiki',
        'shiki/langs',
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

  site: siteConfig(),

  modules: [
    '@nuxtjs/i18n',
    'nuxt-site-config',
    '@nuxtjs/robots',
    '@nuxt/image',
    'nuxt-auth-utils',
    '@comark/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  fonts: {
    provider: 'npm',
    processCSSVariables: false,
    defaults: {
      weights: [...FONT_WEIGHTS],
      styles: ['normal'],
      subsets: ['latin'],
      preload: false,
    },
    families: [
      {
        name: 'HarmonyOS Sans',
        src: 'https://cdn.jsdelivr.net/npm/@lobehub/webfont-harmony-sans@1.0.0/fonts/HarmonyOS_Sans_Regular.woff2',
        weight: '400',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'HarmonyOS Sans',
        src: 'https://cdn.jsdelivr.net/npm/@lobehub/webfont-harmony-sans@1.0.0/fonts/HarmonyOS_Sans_Medium.woff2',
        weight: '500',
        style: 'normal',
        preload: false,
        global: true,
      },
      // HarmonyOS Sans does not ship a Semibold file; Medium is the nearest bundled face for 600.
      {
        name: 'HarmonyOS Sans',
        src: 'https://cdn.jsdelivr.net/npm/@lobehub/webfont-harmony-sans@1.0.0/fonts/HarmonyOS_Sans_Medium.woff2',
        weight: '600',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'HarmonyOS Sans',
        src: 'https://cdn.jsdelivr.net/npm/@lobehub/webfont-harmony-sans@1.0.0/fonts/HarmonyOS_Sans_Bold.woff2',
        weight: '700',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'HarmonyOS Sans',
        src: 'https://cdn.jsdelivr.net/npm/@lobehub/webfont-harmony-sans@1.0.0/fonts/HarmonyOS_Sans_Black.woff2',
        weight: '800',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'MiSans Latin',
        src: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Latin/MiSansLatin-Regular.woff2',
        weight: '400',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'MiSans Latin',
        src: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Latin/MiSansLatin-Medium.woff2',
        weight: '500',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'MiSans Latin',
        src: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Latin/MiSansLatin-Semibold.woff2',
        weight: '600',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'MiSans Latin',
        src: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Latin/MiSansLatin-Bold.woff2',
        weight: '700',
        style: 'normal',
        preload: false,
        global: true,
      },
      {
        name: 'MiSans Latin',
        src: 'https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Latin/MiSansLatin-Heavy.woff2',
        weight: '800',
        style: 'normal',
        preload: false,
        global: true,
      },
      ...fontsourceLatinFaces({
        name: 'Maple Mono',
        packageName: '@fontsource/maple-mono',
        slug: 'maple-mono',
        version: '5.2.6',
      }),
      ...fontsourceLatinFaces({
        name: 'JetBrains Mono',
        packageName: '@fontsource/jetbrains-mono',
        slug: 'jetbrains-mono',
        version: '5.2.8',
      }),
    ],
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
});
