import { afterEach, describe, expect, test } from 'bun:test';

import createFocusTrapController from '../app/utils/createFocusTrapController';

class FakeElement {
  dataset: Record<string, string> = { focusTrapVisible: 'true' };
  isConnected = true;
  offsetParent: object | null = {};
  tabindex = '0';

  constructor(
    readonly id: string,
    private readonly ownerDocument: { activeElement: FakeElement | null },
    private readonly children: FakeElement[] = [],
    options: { tabindex?: string } = {}
  ) {
    this.tabindex = options.tabindex ?? '0';
  }

  getAttribute(name: string) {
    if (name === 'tabindex') return this.tabindex;
    return null;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  querySelectorAll() {
    return this.children;
  }
}

const setupDom = () => {
  const fakeDocument = { activeElement: null as FakeElement | null };
  const opener = new FakeElement('opener', fakeDocument);
  const scrim = new FakeElement('scrim', fakeDocument, [], { tabindex: '-1' });
  const closeButton = new FakeElement('close', fakeDocument);
  const repoInput = new FakeElement('repo', fakeDocument);
  const applyButton = new FakeElement('apply', fakeDocument);
  const drawer = new FakeElement('drawer', fakeDocument, [
    scrim,
    closeButton,
    repoInput,
    applyButton,
  ]);
  globalThis.document = fakeDocument as unknown as Document;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;

  return {
    opener,
    scrim,
    drawer,
    closeButton,
    applyButton,
    get activeElement() {
      return fakeDocument.activeElement;
    },
  };
};

const createTabEvent = (shiftKey = false) => {
  let defaultPrevented = false;
  return {
    key: 'Tab',
    shiftKey,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  } as KeyboardEvent;
};

afterEach(() => {
  delete (globalThis as { document?: Document }).document;
  delete (globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement;
});

describe('dashboard filter drawer focus trap', () => {
  test('focuses the first drawer control and restores opener focus', () => {
    const state = setupDom();
    const focusTrap = createFocusTrapController();

    state.opener.focus();
    focusTrap.capturePreviousFocus();
    focusTrap.focusInitialElement(state.drawer as unknown as HTMLElement);
    expect(state.activeElement).toBe(state.closeButton);

    focusTrap.restorePreviousFocus();
    expect(state.activeElement).toBe(state.opener);
  });

  test('wraps Tab and Shift+Tab inside the drawer', () => {
    const state = setupDom();
    const focusTrap = createFocusTrapController();

    state.applyButton.focus();
    const tabEvent = createTabEvent();
    focusTrap.trapTabKey(tabEvent, state.drawer as unknown as HTMLElement);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(state.activeElement).toBe(state.closeButton);

    const shiftTabEvent = createTabEvent(true);
    focusTrap.trapTabKey(shiftTabEvent, state.drawer as unknown as HTMLElement);
    expect(shiftTabEvent.defaultPrevented).toBe(true);
    expect(state.activeElement).toBe(state.applyButton);
  });
});
