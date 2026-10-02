import { afterEach, beforeEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { compileVue } from './helpers/compile-vue';
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
