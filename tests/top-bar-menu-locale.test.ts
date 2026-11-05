import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { holdTopBarMenu } from '../app/utils/holdTopBarMenu';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('span') });
const Switcher = await compileVue('app/components/LanguageSwitcher.vue');

// The shared trailing controls live in ChromeActions; the header only places them.
const ChromeActions = await compileVue('app/components/layouts/ChromeActions.vue', {
  '@lucide/vue': { EllipsisIcon: icon },
  'vue-i18n': {
    useI18n: () => ({ t: (key: string) => key }),
  },
  '~/components/LanguageSwitcher.vue': { default: Switcher },
  '~/components/ui/ColorModeToggle.vue': { default: icon },
  '~/components/ui/GitHubIcon.vue': { default: icon },
  '~/components/ui/LinkIcon.vue': { default: icon },
});

const Header = await compileVue('app/components/dashboard/overlay/DashboardTopHeader.vue', {
  '@lucide/vue': {
    ArrowLeftIcon: icon,
    CircleDotIcon: icon,
    CircleMinusIcon: icon,
    HouseIcon: icon,
    MessageSquareIcon: icon,
    EllipsisIcon: icon,
    PanelRightCloseIcon: icon,
    PanelRightOpenIcon: icon,
  },
  'vue-i18n': {
    useI18n: () => ({
      t: (key: string) => key,
    }),
  },
  '~/components/layouts/ChromeActions.vue': { default: ChromeActions },
  '~/utils/getPullRequestStateVisual': { getPullRequestStateIcon: () => null },
});

const button = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('button')].find((node) => node.textContent?.trim() === name);

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  holdTopBarMenu.take();
  dom = createVueDom({
    holdTopBarMenu,
    useDetailSidebarViewport: () => ({
      isDetailSidebarSheetViewport: shallowRef(false),
    }),
    useI18n: () => ({
      locale: shallowRef('en'),
      locales: shallowRef([
        { code: 'en', name: 'English' },
        { code: 'zh-cn', name: '中文' },
      ]),
      t: (key: string) => key,
    }),
    useSwitchLocalePath: () => (code: string) =>
      code === 'zh-cn' ? '/zh-cn/dashboard/settings' : '/dashboard/settings',
    useRouter: () => ({
      replace: () => Promise.resolve(),
      push: () => Promise.resolve(),
    }),
  });
});

afterEach(async () => {
  holdTopBarMenu.take();
  await dom.cleanup();
});

const mountHeader = () =>
  dom.mount(
    defineComponent({
      setup: () => () =>
        h(Header, {
          backLabel: 'Back',
          homeLabel: 'Home',
          showHomeButton: false,
        }),
    })
  );

describe('top bar language menu', () => {
  test('keeps the more menu open when a locale switch recreates the page', async () => {
    const first = mountHeader();
    first.root
      .querySelector('.chrome-actions__more-toggle')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await nextTick();

    const menu = first.root.querySelector('.chrome-actions__menu');
    button(menu ?? first.root, '中文')?.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true })
    );
    await Promise.resolve();
    first.unmount();

    const second = mountHeader();
    await nextTick();

    const menuOpen = second.root.querySelector('.chrome-actions__menu') !== null;
    expect(menuOpen).toBe(true);
  });

  test('a bar that survives the locale switch does not open the next bar menu', async () => {
    // The public top bar lives in a persistent layout: a locale switch re-renders
    // the page but not the bar, so nothing consumes the held open state.
    const persistent = dom.mount(defineComponent({ setup: () => () => h(ChromeActions as never) }));
    persistent.root
      .querySelector('.chrome-actions__more-toggle')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await nextTick();

    const menu = persistent.root.querySelector('.chrome-actions__menu');
    button(menu ?? persistent.root, '中文')?.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true })
    );
    await Promise.resolve();
    persistent.unmount();

    const recreated = dom.mount(
      defineComponent({
        setup: () => () => h(ChromeActions as never, { holdOpenOnLocaleSwitch: true }),
      })
    );
    await nextTick();

    expect(recreated.root.querySelector('.chrome-actions__menu')).toBeNull();
  });
});
