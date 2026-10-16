import { afterEach, beforeEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { compileVue as compileSfc } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
const compileVue = (path: string, modules: Record<string, unknown> = {}) =>
  compileSfc(path, { '~/components/ui/ScrollArea.vue': { default: ScrollArea }, ...modules });
import { createVueDom } from './helpers/vue-dom';

const icon = () => h('span');
const FilterMultiSelect = await compileVue('app/components/ui/FilterMultiSelect.vue', {
  '@lucide/vue': { CheckIcon: icon, SearchIcon: icon, XIcon: icon },
});
let dom: ReturnType<typeof createVueDom>;
beforeEach(() => {
  dom = createVueDom();
});
afterEach(async () => {
  await dom.cleanup();
});

test('Escape closes the repository dropdown first and the parent panel on the next press', async () => {
  const open = shallowRef(true);
  const view = dom.mount(
    defineComponent({
      setup() {
        const panel = shallowRef<HTMLElement | null>(null);
        const { handleKeydown } = useModalLifecycle({
          open,
          panel,
          onRequestClose: () => {
            open.value = false;
          },
        });
        return () =>
          open.value
            ? h('aside', { ref: panel, tabindex: -1, onKeydown: handleKeydown }, [
                h(FilterMultiSelect, { modelValue: [], suggestions: [{ value: 'octo/widgets' }] }),
              ])
            : null;
      },
    })
  );
  await nextTick();
  const input = view.root.querySelector('input')!;
  input.focus();
  await nextTick();
  expect(input.getAttribute('aria-expanded')).toBe('true');
  const pressEscape = () =>
    input.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    );
  pressEscape();
  await nextTick();
  expect(open.value).toBe(true);
  expect(input.getAttribute('aria-expanded')).toBe('false');
  pressEscape();
  await nextTick();
  expect(open.value).toBe(false);
});

test('repository keyboard navigation reveals its option and scrollbar-shell interaction keeps the menu open', async () => {
  const revealed: HTMLElement[] = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function () {
    revealed.push(this as unknown as HTMLElement);
  };
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(FilterMultiSelect, {
          modelValue: [],
          suggestions: [{ value: 'octo/first' }, { value: 'octo/second' }],
        }),
    })
  );
  const input = view.root.querySelector('input')!;
  input.focus();
  await nextTick();
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await nextTick();
  expect(revealed.at(-1)?.textContent).toContain('octo/first');
  // The shell also contains the managed scrollbar, outside the content viewport.
  dom.document
    .getElementById(input.getAttribute('aria-controls')!)!
    .dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  expect(input.getAttribute('aria-expanded')).toBe('true');
  dom.document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
  await nextTick();
  expect(input.getAttribute('aria-expanded')).toBe('false');
});
