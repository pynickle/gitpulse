import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ render: () => h('svg') });

const TabSidebar = await compileVue('app/components/dashboard/tab-sidebar/TabSidebar.vue', {
  '@lucide/vue': { PlusIcon: icon, MinusIcon: icon, SlidersHorizontalIcon: icon },
  '~/composables/useTabGroups': { DEFAULT_CUSTOM_TAB_GROUP_ID: 'general' },
});

const groups = [{ id: 'general', name: 'General', collapsed: false }];
const tabs = [
  { id: 'inbox', groupId: 'general', name: 'Inbox', icon },
  { id: 'archive', groupId: 'general', name: 'Archive', icon },
];

const events: Array<{ type: string; payload: string }> = [];

let dom: ReturnType<typeof createVueDom>;

function mountSidebar(activeTabId = 'inbox') {
  const Harness = defineComponent({
    setup: () => () =>
      h(TabSidebar, {
        groups,
        tabs,
        activeTabId,
        onTabSelect: (tabId: string) => events.push({ type: 'tab-select', payload: tabId }),
        onGroupToggle: (groupId: string) => events.push({ type: 'group-toggle', payload: groupId }),
      }),
  });
  return dom.mount(Harness).root;
}

const focusables = (root: ParentNode) => [...root.querySelectorAll('.tab-sidebar__tab')];

beforeEach(() => {
  events.length = 0;
  dom = createVueDom({
    useI18n: () => ({ t: (key: string) => key }),
  });
});

afterEach(async () => {
  await dom.cleanup();
});

describe('TabSidebar', () => {
  test('exposes the views as a list, with no tree role it cannot honour', () => {
    const root = mountSidebar();

    expect([...root.querySelectorAll('[role="tree"], [role="treeitem"]')]).toHaveLength(0);
    expect([...root.querySelectorAll('.tab-sidebar__tab')]).toHaveLength(2);
  });

  test('keeps every list item inside a list, so each one is still announced as an item', () => {
    const root = mountSidebar();

    const listItems = [...root.querySelectorAll('li')];
    expect(listItems.length).toBeGreaterThan(0);
    const orphans = listItems
      .filter((item) => !['UL', 'OL', 'MENU'].includes(item.parentElement?.tagName ?? ''))
      .map((item) => item.textContent?.trim());
    expect(orphans).toEqual([]);

    // A role on the list element itself replaces its list semantics and orphans those items.
    const roleOverriddenLists = [...root.querySelectorAll('ul')]
      .filter((list) => list.hasAttribute('role'))
      .map((list) => list.getAttribute('role'));
    expect(roleOverriddenLists).toEqual([]);
  });

  test('marks the active view and reports the one the reader picks', () => {
    const root = mountSidebar('archive');

    const current = focusables(root).filter((node) => node.getAttribute('aria-current') === 'page');
    expect(current.map((node) => node.textContent?.trim())).toEqual(['Archive']);

    focusables(root)[0]?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    expect(events).toEqual([{ type: 'tab-select', payload: 'inbox' }]);
  });

  test('tells assistive tech whether a group is open and reports the toggle', () => {
    const root = mountSidebar();

    const groupButton = root.querySelector('.tab-sidebar__group');
    expect(groupButton?.getAttribute('aria-expanded')).toBe('true');

    groupButton?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    expect(events).toEqual([{ type: 'group-toggle', payload: 'general' }]);
  });
});
