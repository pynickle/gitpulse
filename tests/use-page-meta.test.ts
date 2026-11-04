import { expect, test } from 'bun:test';

import { useSeoMeta } from '@unhead/vue';
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server';
import { computed, effectScope, ref, unref } from 'vue';

import { usePageMeta } from '../app/composables/usePageMeta';

type ServerHead = ReturnType<typeof createServerHead>;

/** Runs app code against a single head instance, the way Nuxt provides `useSeoMeta`. */
function installGlobals(head: ServerHead) {
  const originals = new Map(
    ['computed', 'unref', 'useSeoMeta'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  Object.assign(globalThis, {
    computed,
    unref,
    useSeoMeta: (
      input: Parameters<typeof useSeoMeta>[0],
      options?: Parameters<typeof useSeoMeta>[1]
    ) => useSeoMeta(input, { ...options, head }),
  });

  return () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  };
}

/** One page component calling `usePageMeta`. */
async function renderPageMeta(title: string | undefined, meta?: Parameters<typeof usePageMeta>[1]) {
  const head = createServerHead();
  const restore = installGlobals(head);
  const scope = effectScope();
  try {
    scope.run(() => usePageMeta(title, meta));
    return renderSSRHead(head);
  } finally {
    scope.stop();
    restore();
  }
}

/**
 * A parent route component and a child page component both declaring page meta,
 * as `app/pages/dashboard.vue` and its child pages do.
 */
async function renderLayeredPageMeta(
  parentTitle: string | undefined,
  childTitle: string | undefined
) {
  const head = createServerHead();
  const restore = installGlobals(head);
  const appScope = effectScope();
  const parentScope = effectScope();
  const childScope = effectScope();
  try {
    // app.vue's titleTemplate, verbatim.
    appScope.run(() =>
      useSeoMeta(
        {
          titleTemplate: (titleChunk) =>
            titleChunk && titleChunk !== 'GitPulse' ? `${titleChunk} - GitPulse` : 'GitPulse',
        },
        { head }
      )
    );
    parentScope.run(() => usePageMeta(parentTitle));
    childScope.run(() => usePageMeta(childTitle));
    return renderSSRHead(head);
  } finally {
    childScope.stop();
    parentScope.stop();
    appScope.stop();
    restore();
  }
}

test('page meta publishes Open Graph title and description without Twitter duplicates', async () => {
  const title = ref('Issue title');
  const description = ref('Body excerpt');
  const rendered = await renderPageMeta(title, { description });

  expect(rendered.headTags).toContain('property="og:title" content="Issue title"');
  expect(rendered.headTags).toContain('property="og:description" content="Body excerpt"');
  expect(rendered.headTags).not.toContain('twitter:title');
  expect(rendered.headTags).not.toContain('twitter:description');
  expect(rendered.headTags).not.toContain('twitter:card');
});

test('an explicit twitter card is the only twitter tag page meta emits', async () => {
  const rendered = await renderPageMeta('Release', {
    description: 'Notes',
    twitterCard: 'summary',
  });

  expect(rendered.headTags).toContain('name="twitter:card" content="summary"');
  expect(rendered.headTags).toContain('property="og:title" content="Release"');
  expect(rendered.headTags).not.toContain('twitter:title');
  expect(rendered.headTags).not.toContain('twitter:description');
});

test('a page that has no title of its own renders the app title, not the ancestor page title', async () => {
  const rendered = await renderLayeredPageMeta('Notifications', '');

  expect(rendered.headTags).toContain('<title>GitPulse</title>');
  expect(rendered.headTags).not.toContain('Notifications');
});

test('an undefined title hands the title over to the ancestor page', async () => {
  const rendered = await renderLayeredPageMeta('Notifications', undefined);

  expect(rendered.headTags).toContain('<title>Notifications - GitPulse</title>');
});
