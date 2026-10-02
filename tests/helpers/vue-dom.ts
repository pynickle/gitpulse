import { Window } from 'happy-dom';
import { createRenderer, nextTick, shallowRef, type Component } from 'vue';

import { useModalState } from '../../app/composables/useModalState';
import createFocusTrapController from '../../app/utils/createFocusTrapController';
import resolveReleaseDrawerSheetGesture from '../../app/utils/resolveReleaseDrawerSheetGesture';

export function createVueDom(extraGlobals: Record<string, unknown> = {}) {
  const window = new Window({ width: 390, height: 844 });
  const document = window.document as unknown as Document;
  const state = new Map<string, ReturnType<typeof shallowRef>>();
  const globals = {
    window,
    document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    useModalState,
    createFocusTrapController,
    resolveReleaseDrawerSheetGesture,
    useState: (key: string, init: () => unknown) => {
      if (!state.has(key)) state.set(key, shallowRef(init()));
      return state.get(key)!;
    },
    ...extraGlobals,
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  );
  Object.assign(globalThis, globals);

  // Use Vue's real renderer/scheduler with this test's document. runtime-dom caches the
  // global document at import time, which depends on unrelated Bun test import order.
  const renderer = createRenderer<Node, HTMLElement>({
    createElement: (tag) => document.createElement(tag),
    createText: (text) => document.createTextNode(text),
    createComment: (text) => document.createComment(text),
    setText: (node, text) => {
      node.nodeValue = text;
    },
    setElementText: (node, text) => {
      node.textContent = text;
    },
    parentNode: (node) => node.parentNode as HTMLElement | null,
    nextSibling: (node) => node.nextSibling,
    querySelector: (selector) => document.querySelector(selector),
    insert: (node, parent, anchor = null) => {
      parent.insertBefore(node, anchor);
    },
    remove: (node) => {
      node.parentNode?.removeChild(node);
    },
    patchProp: (element, key, previous, next) => {
      if (key.startsWith('on')) {
        const event = key.slice(2).toLowerCase();
        if (previous) element.removeEventListener(event, previous);
        if (next) element.addEventListener(event, next);
      } else if (key === 'style') {
        element.removeAttribute('style');
        Object.assign(element.style, next);
      } else if (next == null || (next === false && !key.startsWith('aria-'))) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, String(next));
      }
    },
  });
  const apps: ReturnType<typeof renderer.createApp>[] = [];
  return {
    window,
    document,
    mount(component: Component) {
      const root = document.createElement('div');
      document.body.append(root);
      const app = renderer.createApp(component);
      apps.push(app);
      app.mount(root);
      return {
        root,
        unmount() {
          const index = apps.indexOf(app);
          if (index !== -1) {
            apps.splice(index, 1);
            app.unmount();
          }
        },
      };
    },
    async cleanup() {
      for (const app of apps.splice(0)) app.unmount();
      await nextTick();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      await window.happyDOM.close();
    },
  };
}
