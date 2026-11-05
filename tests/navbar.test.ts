import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const stub = defineComponent({ setup: () => () => h('span') });
const NuxtLinkLocale = defineComponent({
  props: { to: { type: String, required: true } },
  setup:
    (props, { slots }) =>
    () =>
      h('a', { href: props.to }, slots.default?.()),
});
const ColorScheme = defineComponent({
  inheritAttrs: false,
  setup:
    (_, { slots }) =>
    () =>
      slots.default?.(),
});

const NavbarBrand = await compileVue(
  'app/components/layouts/NavbarBrand.vue',
  {
    '~/components/ui/RoundImg.vue': { default: stub },
    'virtual:nuxt-link-locale': { NuxtLinkLocale },
    'virtual:color-scheme': { ColorScheme },
  },
  {
    NuxtLinkLocale: 'virtual:nuxt-link-locale',
    ColorScheme: 'virtual:color-scheme',
  }
);

const Navbar = await compileVue(
  'app/components/layouts/Navbar.vue',
  {
    '~/components/layouts/NavbarBrand.vue': { default: NavbarBrand },
    '~/components/ui/ColorModeToggle.vue': { default: stub },
    '~/components/ui/GitHubIcon.vue': { default: stub },
    '~/components/ui/LinkIcon.vue': { default: stub },
    'virtual:language-switcher': { LanguageSwitcher: stub },
  },
  { LanguageSwitcher: 'virtual:language-switcher' }
);

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom.cleanup();
});

const mountNavbar = (variant?: 'app' | 'public') => {
  dom = createVueDom({
    useI18n: () => ({ t: (key: string) => (key === 'app.title' ? 'GitPulse' : key) }),
    useColorMode: () => shallowRef('light'),
  });
  return dom.mount(defineComponent({ setup: () => () => h(Navbar as never, { variant }) })).root;
};

describe('Navbar', () => {
  test('links the localized brand name to the locale root', () => {
    const brand = mountNavbar('public').querySelector('.navbar-brand-link');

    expect(brand?.textContent?.trim()).toBe('GitPulse');
    expect(brand?.getAttribute('href')).toBe('/');
  });

  test('keeps the dashboard brand as the page heading', () => {
    expect(mountNavbar().querySelector('h1.title')?.textContent?.trim()).toBe('GitPulse');
  });

  test('keeps the public shell brand out of the heading outline', () => {
    const root = mountNavbar('public');

    expect(root.querySelector('h1.title')).toBeNull();
    expect(root.querySelector('span.title')?.textContent?.trim()).toBe('GitPulse');
  });

  test('keeps the controls visible on narrow viewports only for the public shell', () => {
    const appRoot = mountNavbar();
    const publicRoot = dom.mount(
      defineComponent({ setup: () => () => h(Navbar as never, { variant: 'public' }) })
    ).root;

    const appActions = appRoot.querySelector('.navbar-bar__actions');
    expect(appActions?.classList.contains('navbar-bar__actions--always')).toBe(false);
    expect(publicRoot.querySelector('.navbar-bar__actions--always')).toBeTruthy();
  });
});
