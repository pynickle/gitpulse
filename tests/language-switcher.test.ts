import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, onBeforeUnmount, onMounted, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const Switcher = await compileVue('app/components/LanguageSwitcher.vue');

const calls: Array<{ method: 'replace' | 'push'; path: string }> = [];

const button = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('button')].find((node) => node.textContent?.trim() === name);

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  calls.length = 0;
  dom = createVueDom({
    useI18n: () => ({
      locale: shallowRef('en'),
      locales: shallowRef([
        { code: 'en', name: 'English' },
        { code: 'zh-cn', name: '中文' },
      ]),
      t: (key: string) => key,
    }),
    useSwitchLocalePath: () => (code: string) =>
      code === 'zh-cn'
        ? '/zh-cn/dashboard/settings?repo=gitpulse'
        : '/dashboard/settings?repo=gitpulse',
    useRouter: () => ({
      replace: (path: string) => {
        calls.push({ method: 'replace', path });
        return Promise.resolve();
      },
      push: (path: string) => {
        calls.push({ method: 'push', path });
        return Promise.resolve();
      },
    }),
  });
});

afterEach(async () => {
  await dom.cleanup();
});

describe('LanguageSwitcher', () => {
  test('replaces the current history entry with the other locale URL', async () => {
    const { root } = dom.mount(Switcher);

    expect(root.querySelector('.filter-dropdown-panel')).toBeNull();
    expect(button(root, 'English')?.getAttribute('aria-pressed')).toBe('true');
    expect(button(root, '中文')?.getAttribute('aria-pressed')).toBe('false');

    button(root, 'English')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    button(root, '中文')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(calls).toEqual([{ method: 'replace', path: '/zh-cn/dashboard/settings?repo=gitpulse' }]);
  });

  test('a menu that closes on outside clicks still commits the locale choice', async () => {
    const open = shallowRef(true);
    const menu = shallowRef<HTMLElement | null>(null);
    const Harness = defineComponent({
      setup() {
        const onClick = (event: Event) => {
          if (!open.value) return;
          const target = event.target;
          if (target instanceof dom.window.Node && menu.value?.contains(target)) return;
          open.value = false;
        };

        onMounted(() => document.addEventListener('click', onClick, true));
        onBeforeUnmount(() => document.removeEventListener('click', onClick, true));

        return () =>
          open.value
            ? h('div', { ref: menu, class: 'menu' }, [h(Switcher)])
            : h('div', { class: 'closed' });
      },
    });

    const { root } = dom.mount(Harness);

    button(root, '中文')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(root.querySelector('.closed')).toBeNull();
    expect(button(root, '中文')).toBeTruthy();
    expect(calls).toEqual([{ method: 'replace', path: '/zh-cn/dashboard/settings?repo=gitpulse' }]);
  });
});
