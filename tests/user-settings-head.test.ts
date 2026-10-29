import { expect, mock, test } from 'bun:test';

import { useHead } from '@unhead/vue';
import { createHead as createClientHead, renderDOMHead } from '@unhead/vue/client';
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server';
import { effectScope, nextTick, shallowRef, watch } from 'vue';

import * as themePaletteModule from '../shared/utils/theme-palette';
import { createVueDom } from './helpers/vue-dom';

mock.module('#shared/utils/theme-palette', () => themePaletteModule);

test.each(['server', 'client'] as const)(
  '%s font settings render as root styles above stylesheet defaults',
  async (mode) => {
    const dom = createVueDom();
    const head =
      mode === 'server'
        ? createServerHead()
        : createClientHead({ document: dom.document, render: () => {} });
    const appFontFamily = shallowRef('"Custom App", sans-serif');
    const codeFontFamily = shallowRef('"Custom Code", monospace');
    const prReviewCodeFontSizePx = shallowRef('16px');
    const globals = {
      defineNuxtPlugin: (setup: () => Promise<void>) => setup,
      useHead: (input: Parameters<typeof useHead>[0]) => useHead(input, { head }),
      useUserSession: () => ({ loggedIn: shallowRef(false) }),
      useUserSettings: () => ({
        loadSettings: async () => {},
        appFontFamily,
        codeFontFamily,
        prReviewCodeFontSizePx,
      }),
      watch,
    };
    const originals = new Map(
      Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
    );
    const scope = effectScope();
    Object.assign(globalThis, globals);
    try {
      const { default: plugin } = await import('../app/plugins/user-settings');
      await scope.run(() => plugin({} as Parameters<typeof plugin>[0]));

      if (mode === 'client') {
        await renderDOMHead(head);
        expect(
          dom.document.documentElement.style.getPropertyValue('--gitpulse-app-font-family')
        ).toBe('"Custom App", sans-serif');
        expect(
          dom.document.documentElement.style.getPropertyValue('--gitpulse-pr-review-code-font-size')
        ).toBe('16px');
      }

      appFontFamily.value = 'system-ui';
      prReviewCodeFontSizePx.value = '18px';
      if (mode === 'server') {
        // SSR loads account settings after registering head but before rendering it.
        const rendered = await renderSSRHead(head);
        expect(rendered.htmlAttrs).toContain('--gitpulse-app-font-family:system-ui');
        expect(rendered.htmlAttrs).toContain('--gitpulse-pr-review-code-font-size:18px');
        expect(rendered.htmlAttrs).toContain('Custom Code');
        expect(rendered.htmlAttrs).not.toContain('Custom App');
      } else {
        await nextTick();
        await renderDOMHead(head);
        expect(
          dom.document.documentElement.style.getPropertyValue('--gitpulse-app-font-family')
        ).toBe('system-ui');
        expect(
          dom.document.documentElement.style.getPropertyValue('--gitpulse-pr-review-code-font-size')
        ).toBe('18px');
      }
    } finally {
      scope.stop();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      await dom.cleanup();
    }
  }
);
