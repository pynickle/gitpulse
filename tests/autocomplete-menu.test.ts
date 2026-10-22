import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const empty = defineComponent({ setup: () => () => h('span') });
const AutocompleteMenu = await compileVue('app/components/ui/AutocompleteMenu.vue', {
  '@lucide/vue': { SearchIcon: empty },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
});

test('autocomplete highlights literal queries without interpreting labels as HTML', async () => {
  const dom = createVueDom();
  const query = shallowRef('amp');
  const suggestion = { value: 'example', label: '<img src=x> & Example [a.b]' };
  const selected: unknown[] = [];
  try {
    dom.mount(
      defineComponent({
        setup: () => () =>
          h(AutocompleteMenu, {
            open: true,
            suggestions: [suggestion],
            query: query.value,
            activeIndex: 0,
            listboxId: 'suggestions',
            optionIdPrefix: 'suggestion',
            panelStyle: {},
            onSelect: (value: unknown) => selected.push(value),
          }),
      })
    );
    await nextTick();
    const label = dom.document.querySelector('.fa-option-label')!;
    expect(label.textContent).toBe(suggestion.label);
    expect(label.querySelector('img')).toBeNull();
    expect([...label.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['amp']);

    query.value = '[a.b]';
    await nextTick();
    expect(label.textContent).toBe(suggestion.label);
    expect(label.querySelector('mark')?.textContent).toBe('[a.b]');

    query.value = '  ';
    await nextTick();
    expect(label.querySelector('mark')).toBeNull();
    dom.document.querySelector<HTMLElement>('[role="option"]')!.click();
    expect(selected).toEqual([suggestion]);
  } finally {
    await dom.cleanup();
  }
});
