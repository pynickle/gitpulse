import { describe, expect, mock, test } from 'bun:test';

import { useHead } from '@unhead/vue';
import { createHead as createClientHead, renderDOMHead } from '@unhead/vue/client';
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server';
import { effectScope, shallowRef, watch } from 'vue';

import paletteData from '../shared/data/theme-palette.json';
import * as themePaletteModule from '../shared/utils/theme-palette';
import { createVueDom } from './helpers/vue-dom';

mock.module('#shared/utils/theme-palette', () => themePaletteModule);

/** The CSS a rule block declares, keyed by custom property name. */
function parseDeclarations(block: string): Record<string, string> {
  return Object.fromEntries(
    block
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(':');
        return [
          declaration.slice(0, separator).trim(),
          declaration.slice(separator + 1).trim(),
        ] as const;
      })
  );
}

/** Every selector in [css] mapped to the custom properties it declares. */
function parseRules(css: string): Record<string, Record<string, string>> {
  return Object.fromEntries(
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [
      selector!.trim(),
      parseDeclarations(body!),
    ])
  );
}

/** The palette rules the startup plugin put in the document head. */
async function renderInjectedPalette(mode: 'server' | 'client'): Promise<Record<string, unknown>> {
  const dom = mode === 'client' ? createVueDom() : null;
  const head =
    mode === 'server'
      ? createServerHead()
      : createClientHead({ document: dom!.document, render: () => {} });
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

    const css =
      mode === 'server'
        ? [...(await renderSSRHead(head)).headTags.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
            .map(([, body]) => body)
            .join('')
        : [...(await renderDOMHead(head), dom!.document.head.querySelectorAll('style'))]
            .map((style) => style.textContent ?? '')
            .join('');

    return parseRules(css);
  } finally {
    scope.stop();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await dom?.cleanup();
  }
}

describe.each(['server', 'client'] as const)('%s palette injection', (mode) => {
  test('the light presentation is injected as root custom properties', async () => {
    const rules = await renderInjectedPalette(mode);

    expect(rules[':root']).toEqual(
      Object.fromEntries(
        Object.entries(paletteData.light).map(([tone, value]) => [`--gitpulse-${tone}`, value])
      )
    );
  });

  test("the dark presentation is injected under the stylesheet's dark selector", async () => {
    const rules = await renderInjectedPalette(mode);

    expect(rules['html.dark']).toEqual(
      Object.fromEntries(
        Object.entries(paletteData.dark).map(([tone, value]) => [`--gitpulse-${tone}`, value])
      )
    );
  });
});

test("the accent is the web app's indigo and the GitHub green stays a success tone", () => {
  expect(paletteData.light.accent).toBe('#4f46e5');
  expect(paletteData.dark.accent).toBe('#a5b4fc');

  const greenToneNames = Object.entries(paletteData)
    .flatMap(([presentation, tones]) =>
      Object.entries(tones).map(([tone, value]) => [`${presentation}.${tone}`, value] as const)
    )
    .filter(([, value]) => value === '#238636')
    .map(([name]) => name);

  expect(greenToneNames).toEqual(['dark.success-solid']);
});
