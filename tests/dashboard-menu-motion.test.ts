import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef, type Ref } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('span') });
const TabSidebarStub = defineComponent({
  props: ['groups', 'tabs', 'activeTabId'],
  setup: () => () => h('div', { class: 'tab-sidebar-stub' }),
});

const DashboardMenu = await compileVue('app/components/dashboard/DashboardMenu.vue', {
  '@lucide/vue': {
    BellIcon: icon,
    BookMarkedIcon: icon,
    CircleDotIcon: icon,
    GitPullRequestIcon: icon,
    InboxIcon: icon,
    ListTodoIcon: icon,
    RocketIcon: icon,
    UserIcon: icon,
  },
  '~/components/dashboard/tab-sidebar/TabSidebar.vue': { default: TabSidebarStub },
});

const PANEL = '.dashboard-menu__panel';
const SCRIM = '.dashboard-menu__scrim';

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom({ useI18n: () => ({ t: (key: string) => key }) });
});

afterEach(async () => {
  await dom.cleanup();
});

const mountMenu = (open: Ref<boolean>) => {
  const closes: string[] = [];
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(DashboardMenu, {
          open: open.value,
          builtInTabs: [{ id: 'inbox', name: 'Inbox', icon: 'inbox' }],
          activeTabId: 'inbox',
          sidebarGroups: [],
          sidebarTabs: [],
          onClose: () => {
            closes.push('close');
          },
        }),
    })
  );

  return { ...mounted, closes };
};

// The exit transition runs on animation frames; give it a few to finish.
const settleMotion = () => new Promise((resolve) => setTimeout(resolve, 150));

describe('DashboardMenu overlay lifecycle', () => {
  test('renders no overlay while the menu is closed', () => {
    const view = mountMenu(shallowRef(false));

    expect(view.root.querySelector(PANEL)).toBeNull();
    expect(view.root.querySelector(SCRIM)).toBeNull();
  });

  test('keeps the panel mounted while it animates closed, then removes it', async () => {
    const open = shallowRef(true);
    const view = mountMenu(open);
    await nextTick();
    expect(view.root.querySelector(PANEL)).not.toBeNull();

    open.value = false;
    await nextTick();
    // The exit animation owns the panel until it finishes — dropping it on the
    // close would make the drawer vanish instead of sliding away.
    expect(view.root.querySelector(PANEL)).not.toBeNull();

    await settleMotion();
    expect(view.root.querySelector(PANEL)).toBeNull();
    expect(view.root.querySelector(SCRIM)).toBeNull();
  });

  test('reopening during the exit animation leaves exactly one overlay', async () => {
    const open = shallowRef(true);
    const view = mountMenu(open);
    await nextTick();

    open.value = false;
    await nextTick();
    open.value = true;
    await nextTick();
    await settleMotion();

    expect(view.root.querySelectorAll(PANEL).length).toBe(1);
    expect(view.root.querySelectorAll(SCRIM).length).toBe(1);
  });

  test('the scrim requests a close when tapped', async () => {
    const open = shallowRef(true);
    const view = mountMenu(open);
    await nextTick();

    view.root
      .querySelector(SCRIM)
      ?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await nextTick();

    expect(view.closes).toEqual(['close']);
  });
});
