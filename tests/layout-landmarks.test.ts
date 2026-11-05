import { afterEach, describe, expect, test } from 'bun:test';

import { computed, defineComponent, h, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const nav = defineComponent({ render: () => h('nav') });
const page = defineComponent({ render: () => h('div', { class: 'stub-page' }) });

const SkipToContentLink = await compileVue('app/components/ui/SkipToContentLink.vue');

// `NuxtPage` is auto-imported in app code, so it reaches the template as unimport would inject it.
const nuxtPageModule = { NuxtPage: page };
const layoutModules = {
  '~/components/layouts/Navbar.vue': { default: nav },
  '~/components/ui/SkipToContentLink.vue': { default: SkipToContentLink },
  'virtual:nuxt-page': nuxtPageModule,
};
const nuxtPageAutoImport = { NuxtPage: 'virtual:nuxt-page' };

// Every signed-out surface renders this shell, so the landmark contract is
// asserted once here instead of once per page.
const PublicShell = await compileVue('app/components/layouts/PublicShell.vue', layoutModules);

const DashboardLayout = await compileVue(
  'app/layouts/dashboard.vue',
  layoutModules,
  nuxtPageAutoImport
);

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom.cleanup();
});

const t = (key: string) => key;

function mountPublicShell() {
  dom = createVueDom({ useI18n: () => ({ t }) });
  const host = defineComponent({
    setup: () => () => h(PublicShell as never, null, { default: () => h(page) }),
  });
  return dom.mount(host).root;
}

function mountDashboard() {
  dom = createVueDom({
    useI18n: () => ({ t }),
    computed,
    useRoute: () => ({ path: '/dashboard', query: {} }),
    useDashboardHomeChrome: () => ({ presentation: shallowRef({ showNavbar: true }) }),
  });
  return dom.mount(DashboardLayout as never).root;
}

/** The single main landmark, the skip link and the page outlet it wraps. */
function expectLandmark(root: ParentNode) {
  const mains = [...root.querySelectorAll('main')];
  expect(mains).toHaveLength(1);

  const main = mains[0]!;
  expect(main.id).not.toBe('');
  // The page the reader came for renders inside the landmark, not beside it.
  expect(main.querySelector('.stub-page')).toBeTruthy();

  // A skip link only moves the reader if its target can take focus.
  expect(main.getAttribute('tabindex')).toBe('-1');

  const skipLink = root.querySelector('a');
  expect(skipLink?.getAttribute('href')).toBe(`#${main.id}`);
  expect(skipLink?.textContent?.trim()).not.toBe('');
}

describe.each([
  ['public shell', mountPublicShell],
  ['dashboard', mountDashboard],
] as const)('%s layout', (_name, mount) => {
  test('wraps the page in a main landmark a skip link can jump to', () => {
    expectLandmark(mount());
  });
});
