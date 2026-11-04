import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { categoryRows, SettingsCategoryNav, svgStub } from './helpers/settings-category-nav';
import { createVueDom } from './helpers/vue-dom';

const items = [
  { id: 'appearance', icon: svgStub, title: 'Appearance', description: '' },
  { id: 'notifications', icon: svgStub, title: 'Notifications', description: '' },
  { id: 'navigation', icon: svgStub, title: 'Navigation', description: '' },
];

const ROW = { left: 6, width: 180, height: 36 };

type RowRect = { top: number; left: number; width: number; height: number };

// happy-dom has no layout, so the test hands the component the rects a browser would report:
// rows stacked from the container's top edge, every one `rowHeight` tall.
const rowRectOf = (element: Element, rowHeight: number): RowRect => {
  if (element.classList.contains('settings-category-nav__item')) {
    const text = (element.textContent ?? '').trim();
    const index = items.findIndex((item) => text.startsWith(item.title));
    if (index >= 0) {
      return { top: index * rowHeight, left: ROW.left, width: ROW.width, height: rowHeight };
    }
  }
  return { top: 0, left: 0, width: ROW.left + ROW.width, height: items.length * ROW.height };
};

type ObservedResize = {
  callback: () => void;
  targets: Element[];
  disconnected: boolean;
};

let observers: ObservedResize[] = [];

class FakeResizeObserver {
  private readonly observed: ObservedResize;

  constructor(callback: () => void) {
    this.observed = { callback, targets: [], disconnected: false };
    observers.push(this.observed);
  }

  observe(target: Element) {
    this.observed.targets.push(target);
  }

  unobserve(target: Element) {
    this.observed.targets = this.observed.targets.filter((seen) => seen !== target);
  }

  disconnect() {
    this.observed.disconnected = true;
    this.observed.targets = [];
  }
}

let dom: ReturnType<typeof createVueDom>;

const stubLayout = (rowHeight = ROW.height) => {
  const prototype = dom.window.Element.prototype as unknown as {
    getBoundingClientRect: () => DOMRect;
  };

  // Each test owns its own happy-dom window, so this patch dies with the window.
  prototype.getBoundingClientRect = function (this: Element) {
    const rect = rowRectOf(this, rowHeight);
    return {
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => rect,
    } as DOMRect;
  };
};

const mountNav = async (activeId: string) => {
  const selected: string[] = [];
  const active = shallowRef(activeId);

  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(SettingsCategoryNav, {
          items,
          activeId: active.value,
          onSelect: (id: string) => {
            selected.push(id);
            active.value = id;
          },
        }),
    })
  );

  // The first measurement is queued during setup and lands after mount.
  await nextTick();

  return { ...view, selected };
};

const clickRow = async (root: ParentNode, index: number) => {
  categoryRows(root)[index]?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  // The row change re-renders first, then the bar measures on the following tick.
  await nextTick();
  await nextTick();
};

const indicatorOf = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.settings-category-nav__indicator');

beforeEach(() => {
  observers = [];
  dom = createVueDom({ ResizeObserver: FakeResizeObserver });
  stubLayout();
});

afterEach(async () => {
  await dom.cleanup();
});

describe('SettingsCategoryNav active indicator', () => {
  test('parks the accent bar on the row the reader currently has open', async () => {
    const { root } = await mountNav('appearance');
    const indicator = indicatorOf(root);

    expect(indicator?.getAttribute('aria-hidden')).toBe('true');
    expect(indicator?.style.transform).toBe(`translate(${ROW.left}px, 0px)`);
    expect(indicator?.style.height).toBe(`${ROW.height}px`);
  });

  test('moves the bar onto the row the reader picks', async () => {
    const { root, selected } = await mountNav('appearance');

    await clickRow(root, 2);

    expect(selected).toEqual(['navigation']);
    expect(indicatorOf(root)?.style.transform).toBe(
      `translate(${ROW.left}px, ${2 * ROW.height}px)`
    );
  });

  test('marks exactly one row as the current page', async () => {
    const { root } = await mountNav('appearance');

    const current = () =>
      categoryRows(root)
        .filter((row) => row.getAttribute('aria-current') === 'page')
        .map((row) => (row.textContent ?? '').trim());

    expect(current()).toEqual(['Appearance']);

    await clickRow(root, 1);

    expect(current()).toEqual(['Notifications']);
  });

  test('draws no bar when no row matches the active id', async () => {
    const { root } = await mountNav('unknown-category');

    expect(indicatorOf(root)).toBeNull();
  });

  test('re-measures when the rows are re-laid out without a category change', async () => {
    const { root } = await mountNav('appearance');
    const navObserver = observers[0];

    expect(navObserver?.targets).toEqual([root.querySelector('.settings-category-nav')]);

    stubLayout(52);
    navObserver?.callback();
    await nextTick();

    expect(indicatorOf(root)?.style.height).toBe('52px');
  });

  test('stops watching the layout once the nav goes away', async () => {
    const view = await mountNav('appearance');
    const navObserver = observers[0];

    view.unmount();

    expect(navObserver?.disconnected).toBe(true);
  });
});
