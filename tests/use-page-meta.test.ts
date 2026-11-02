import { expect, test } from 'bun:test';

import { useSeoMeta } from '@unhead/vue';
import { createHead as createServerHead, renderSSRHead } from '@unhead/vue/server';
import { computed, effectScope, ref, unref } from 'vue';

import { usePageMeta } from '../app/composables/usePageMeta';

async function renderPageMeta(title: string | undefined, meta?: Parameters<typeof usePageMeta>[1]) {
  const head = createServerHead();
  const scope = effectScope();
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
  try {
    scope.run(() => usePageMeta(title, meta));
    return await renderSSRHead(head);
  } finally {
    scope.stop();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
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
