import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import holdDashboardMoreMenu from '../app/utils/holdDashboardMoreMenu';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('span') });
const Switcher = await compileVue('app/components/LanguageSwitcher.vue');
const Header = await compileVue('app/components/dashboard/overlay/DashboardTopHeader.vue', {
  '@lucide/vue': {
    ArrowLeftIcon: icon,
    CircleDotIcon: icon,
    CircleMinusIcon: icon,
    HomeIcon: icon,
    MessageSquareIcon: icon,
    MoreHorizontalIcon: icon,
    PanelRightCloseIcon: icon,
    PanelRightOpenIcon: icon,
  },
  'vue-i18n': {
    useI18n: () => ({
      t: (key: string) => key,
    }),
  },
  '~/components/LanguageSwitcher.vue': { default: Switcher },
  '~/components/ui/ColorModeToggle.vue': { default: icon },
  '~/components/ui/GitHubIcon.vue': { default: icon },
  '~/components/ui/LinkIcon.vue': { default: icon },
  '~/utils/getPullRequestStateVisual': { getPullRequestStateIcon: () => null },
});

const button = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('button')].find((node) => node.textContent?.trim() === name);

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  holdDashboardMoreMenu.take();
  dom = createVueDom({
    holdDashboardMoreMenu,
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
  holdDashboardMoreMenu.take();
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

describe('DashboardTopHeader language menu', () => {
  test('keeps the more menu open when a locale switch recreates the page', async () => {
    const first = mountHeader();
    first.root
      .querySelector('.dashboard-top-header__more-toggle')
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await nextTick();

    const menu = first.root.querySelector('.dashboard-top-header__more-menu');
    button(menu ?? first.root, '中文')?.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true })
    );
    await Promise.resolve();
    first.unmount();

    const second = mountHeader();
    await nextTick();

    const menuOpen = second.root.querySelector('.dashboard-top-header__more-menu') !== null;
    expect(menuOpen).toBe(true);
  });
});
