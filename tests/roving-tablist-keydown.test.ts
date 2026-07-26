import { afterEach, describe, expect, test } from 'bun:test';

import handleRovingTablistKeydown from '../app/utils/handleRovingTablistKeydown';

class FakeTab {
  focused = false;

  focus() {
    this.focused = true;
  }
}

class FakeTablist {
  constructor(readonly tabs: FakeTab[]) {}

  querySelectorAll() {
    return this.tabs;
  }
}

const originalHTMLElement = globalThis.HTMLElement;

const setup = (tabCount: number) => {
  const tabs = Array.from({ length: tabCount }, () => new FakeTab());
  const tablist = new FakeTablist(tabs);
  globalThis.HTMLElement = FakeTablist as unknown as typeof HTMLElement;

  const selected: number[] = [];
  let prevented = false;
  const event = {
    key: '',
    currentTarget: tablist,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as KeyboardEvent;

  const fire = (key: string, activeIndex: number) => {
    prevented = false;
    (event as { key: string }).key = key;
    handleRovingTablistKeydown(event, {
      itemCount: tabCount,
      activeIndex,
      onSelect: (index) => selected.push(index),
    });
    return { prevented };
  };

  return { tabs, selected, fire };
};

afterEach(() => {
  globalThis.HTMLElement = originalHTMLElement;
});

describe('handleRovingTablistKeydown', () => {
  test('ArrowRight selects and focuses the next tab', () => {
    const { tabs, selected, fire } = setup(3);
    const { prevented } = fire('ArrowRight', 0);

    expect(prevented).toBe(true);
    expect(selected).toEqual([1]);
    expect(tabs[1]!.focused).toBe(true);
  });

  test('ArrowLeft selects the previous tab', () => {
    const { selected, fire } = setup(3);
    fire('ArrowLeft', 2);

    expect(selected).toEqual([1]);
  });

  test('does not wrap past the ends', () => {
    const { selected, fire } = setup(3);
    fire('ArrowLeft', 0);
    fire('ArrowRight', 2);

    expect(selected).toEqual([]);
  });

  test('Home and End jump to the first and last tab', () => {
    const { selected, fire } = setup(4);
    fire('Home', 2);
    fire('End', 1);

    expect(selected).toEqual([0, 3]);
  });

  test('ignores unrelated keys', () => {
    const { selected, fire } = setup(3);
    const { prevented } = fire('Enter', 0);

    expect(prevented).toBe(false);
    expect(selected).toEqual([]);
  });

  test('ignores empty tablists', () => {
    const { selected, fire } = setup(0);
    const { prevented } = fire('Home', -1);

    expect(prevented).toBe(false);
    expect(selected).toEqual([]);
  });
});
