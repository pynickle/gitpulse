import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef, useTemplateRef } from 'vue';

import { useAutocompletePanel } from '../app/composables/useAutocompletePanel';
import { createVueDom } from './helpers/vue-dom';

test('an initially open autocomplete panel stops reacting when closed or unmounted', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let closes = 0;
  const open = shallowRef(true);
  const dom = createVueDom({
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup() {
          const anchor = useTemplateRef<HTMLElement>('anchor');
          useAutocompletePanel({
            isOpen: open,
            listboxId: 'suggestions',
            getAnchor: () => anchor.value,
            onClose: () => {
              closes += 1;
            },
          });
          return () => h('input', { ref: 'anchor' });
        },
      })
    );
    await nextTick();
    dom.document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
    expect(closes).toBe(1);
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    expect(frames.size).toBe(1);

    open.value = false;
    await nextTick();
    expect(frames.size).toBe(0);
    dom.document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
    expect(closes).toBe(1);

    open.value = true;
    await nextTick();
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    dom.document.body.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }));
    expect(frames.size).toBe(0);
    expect(closes).toBe(1);
  } finally {
    await dom.cleanup();
  }
});
