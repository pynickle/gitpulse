import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { useModalState } from '../app/composables/useModalState';
import { createVueDom } from './helpers/vue-dom';

let dom: ReturnType<typeof createVueDom>;
const expectFocus = (element: Element | null) => {
  expect(dom.document.activeElement === element).toBe(true);
};
beforeEach(() => {
  dom = createVueDom();
});
afterEach(async () => {
  await dom.cleanup();
});

function harness(initialOpen = false, controls = true) {
  const open = shallowRef(initialOpen);
  const opener = dom.document.createElement('button');
  dom.document.body.append(opener);
  opener.focus();
  const modal = useModalState();
  const mounted = dom.mount(
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
            ? h(
                'aside',
                { ref: panel, tabindex: -1, onKeydown: handleKeydown },
                controls
                  ? [
                      h('button', { 'data-focus-trap-visible': 'true' }, 'Close'),
                      h('input', { 'data-focus-trap-visible': 'true' }),
                    ]
                  : []
              )
            : null;
      },
    })
  );
  return { ...mounted, open, opener, modal };
}

describe('modal lifecycle through a mounted Vue host', () => {
  test('a nested overlay keeps its focus and handles its own Escape', async () => {
    const view = harness(true);
    await nextTick();
    const nested = dom.document.createElement('button');
    dom.document.body.append(nested);
    view.modal.openModal();
    nested.focus();
    nested.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    );
    expect(view.open.value).toBe(true);
    view.open.value = false;
    await nextTick();
    expectFocus(nested);
    expect(view.modal.openModalCount.value).toBe(1);
    view.modal.closeModal();
  });
  test.each(['close', 'unmount'] as const)(
    '%s before rendering cannot leave a registration or steal focus',
    async (action) => {
      const view = harness();
      view.open.value = true;
      if (action === 'close') view.open.value = false;
      else view.unmount();
      await nextTick();
      expectFocus(view.opener);
      expect(view.modal.openModalCount.value).toBe(0);
    }
  );

  test('unmounting an open panel returns focus and does not release another registration', async () => {
    const view = harness(true);
    view.modal.openModal();
    await nextTick();
    view.unmount();
    await nextTick();
    expectFocus(view.opener);
    expect(view.modal.openModalCount.value).toBe(1);
    view.modal.closeModal();
  });

  test('an empty panel receives initial focus and traps Tab', async () => {
    const view = harness(true, false);
    await nextTick();
    const panel = view.root.querySelector('aside')!;
    expectFocus(panel);
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    panel.dispatchEvent(event as unknown as Event);
    expect(event.defaultPrevented).toBe(true);
    expectFocus(panel);
  });

  test('Tab wraps and an already-consumed Escape does not close the panel', async () => {
    const view = harness(true);
    await nextTick();
    const first = view.root.querySelector('button')!;
    const last = view.root.querySelector('input')!;
    last.focus();
    last.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    );
    expectFocus(first);
    first.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    );
    expectFocus(last);
    const escape = new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    escape.preventDefault();
    last.dispatchEvent(escape as unknown as Event);
    expect(view.open.value).toBe(true);
    last.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }) as unknown as Event
    );
    await nextTick();
    expect(view.open.value).toBe(false);
    expectFocus(view.opener);
  });

  test.each(['removed', 'disabled', 'hidden'] as const)(
    'a %s opener is not used as a return target',
    async (state) => {
      const view = harness(true);
      await nextTick();
      if (state === 'removed') view.opener.remove();
      if (state === 'disabled') view.opener.disabled = true;
      if (state === 'hidden') view.opener.hidden = true;
      view.open.value = false;
      await nextTick();
      expect(dom.document.activeElement === view.opener).toBe(false);
    }
  );
  test('pending initial focus does not override a newer external focus decision', async () => {
    const view = harness();
    const destination = dom.document.createElement('button');
    dom.document.body.append(destination);
    view.open.value = true;
    destination.focus();
    await nextTick();
    expectFocus(destination);
  });
  test.each(['close', 'unmount'] as const)(
    '%s preserves focus deliberately moved outside the panel',
    async (action) => {
      const view = harness(true);
      await nextTick();
      const destination = dom.document.createElement('button');
      dom.document.body.append(destination);
      destination.focus();
      if (action === 'close') view.open.value = false;
      else view.unmount();
      await nextTick();
      expectFocus(destination);
      expect(view.modal.openModalCount.value).toBe(0);
    }
  );
  test('replacing a panel hands focus to its replacement and preserves the external opener', async () => {
    const filter = harness();
    const drawer = harness();
    filter.opener.focus();
    filter.open.value = true;
    await nextTick();
    filter.open.value = false;
    drawer.open.value = true;
    await nextTick();
    expectFocus(drawer.root.querySelector('button'));
    expect(drawer.modal.openModalCount.value).toBe(1);
    drawer.open.value = false;
    await nextTick();
    expectFocus(filter.opener);
    expect(drawer.modal.openModalCount.value).toBe(0);
  });
  test('a rapid reopen keeps panel focus and the original external return target', async () => {
    const view = harness(true);
    await nextTick();
    view.open.value = false;
    view.open.value = true;
    await nextTick();
    expect(view.modal.openModalCount.value).toBe(1);
    expectFocus(view.root.querySelector('button'));
    view.open.value = false;
    await nextTick();
    expectFocus(view.opener);
  });
  test('opens, focuses its first control and restores focus with balanced registration', async () => {
    const view = harness();
    expect(view.modal.openModalCount.value).toBe(0);
    view.open.value = true;
    await nextTick();
    expect(view.modal.openModalCount.value).toBe(1);
    expectFocus(view.root.querySelector('button'));
    view.open.value = false;
    await nextTick();
    expect(view.modal.openModalCount.value).toBe(0);
    expectFocus(view.opener);
  });
});
