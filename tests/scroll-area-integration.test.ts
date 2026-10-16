import { expect, test } from 'bun:test';

import SimpleBar from 'simplebar-vue';
import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

test('ScrollArea publishes the actual scroller, forwards its events, and releases obsolete elements', async () => {
  const dom = createVueDom();
  try {
    const ScrollArea = await compileVue('app/components/ui/ScrollArea.vue', {
      'simplebar-vue': { default: SimpleBar },
    });
    const disabled = shallowRef(false);
    const generation = shallowRef(0);
    const elements: (HTMLElement | null)[] = [];
    const events: Event[] = [];
    const mounted = dom.mount(
      defineComponent({
        setup: () => () =>
          h(
            ScrollArea,
            {
              disabled: disabled.value,
              key: generation.value,
              onScrollElement: (element: HTMLElement | null) => elements.push(element),
              onScroll: (event: Event) => events.push(event),
            },
            { default: () => h('button', 'Content') }
          ),
      })
    );
    await nextTick();
    const scroller = elements.at(-1)!;
    const content = mounted.root.querySelector('button');
    expect(scroller).toBeInstanceOf(dom.window.HTMLElement);
    expect(scroller).not.toBe(mounted.root.firstElementChild);
    expect(scroller.contains(mounted.root.querySelector('button'))).toBe(true);
    const event = new dom.window.Event('scroll');
    scroller.dispatchEvent(event);
    expect(events).toEqual([event]);

    disabled.value = true;
    await nextTick();
    expect(elements.at(-1)).toBeNull();
    expect(mounted.root.querySelector('button')).toBe(content);
    scroller.dispatchEvent(new dom.window.Event('scroll'));
    expect(events).toHaveLength(1);
    disabled.value = false;
    generation.value++;
    await nextTick();
    const replacement = elements.at(-1)!;
    expect(replacement).not.toBe(scroller);
    expect(replacement.isConnected).toBe(true);
    mounted.unmount();
    expect(elements.at(-1)).toBeNull();
    replacement.dispatchEvent(new dom.window.Event('scroll'));
    expect(events).toHaveLength(1);
  } finally {
    await dom.cleanup();
  }
});

test('responsive scroll ownership preserves content and releases the obsolete viewport binding', async () => {
  const dom = createVueDom();
  const listeners = new Set<() => void>();
  let matches = true;
  dom.window.matchMedia = (() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof dom.window.matchMedia;
  try {
    const ScrollArea = await compileVue('app/components/ui/ScrollArea.vue', {
      'simplebar-vue': { default: SimpleBar },
    });
    const elements: (HTMLElement | null)[] = [];
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(
            ScrollArea,
            {
              media: '(min-width: 1025px)',
              onScrollElement: (el: HTMLElement | null) => elements.push(el),
            },
            { default: () => h('textarea') }
          ),
      })
    );
    await nextTick();
    const writer = view.root.querySelector('textarea')!;
    writer.value = 'Unsent draft';
    const viewport = elements.at(-1)!;
    matches = false;
    listeners.forEach((listener) => listener());
    await nextTick();
    expect(elements.at(-1)).toBeNull();
    expect(view.root.querySelector('textarea')).toBe(writer);
    expect(writer.value).toBe('Unsent draft');
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    matches = true;
    listeners.forEach((listener) => listener());
    await nextTick();
    expect(elements.at(-1)).toBe(viewport);
    view.unmount();
    expect(listeners.size).toBe(0);
    expect(elements.at(-1)).toBeNull();
  } finally {
    await dom.cleanup();
  }
});
