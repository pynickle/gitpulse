import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef, Suspense, type Component } from 'vue';

import { commentPresentationModules } from './helpers/comment-presentation';
import { createVueDom } from './helpers/vue-dom';

const presentation = await commentPresentationModules();
const MarkdownRenderer = presentation['~/components/ui/MarkdownRenderer.vue'].default as Component;

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom({
    useNuxtApp: () => ({}),
    useUserSession: () => ({ user: shallowRef(null) }),
    useGitPulseApiFetch: () => async () => ({}),
  });
});

afterEach(async () => {
  await dom.cleanup();
});

describe('MarkdownRenderer GFM table rendering', () => {
  test('renders a GFM table inside .markdown-body with header and body cells', async () => {
    const { root } = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Suspense, null, {
            default: () =>
              h(MarkdownRenderer, {
                value: '| Package | Change |\n|---|---|\n| vue | 3.5 |',
                repoOwner: 'pynickle',
                repoName: 'gitpulse',
              }),
          }),
      })
    );

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (root.querySelector('.markdown-body table')) break;
      await Bun.sleep(10);
      await nextTick();
    }

    const table = root.querySelector('.markdown-body table');
    expect(table).not.toBeNull();
    expect(
      [...root.querySelectorAll('.markdown-body table thead th')].map((el) =>
        el.textContent?.trim()
      )
    ).toEqual(['Package', 'Change']);
    expect(
      [...root.querySelectorAll('.markdown-body table tbody td')].map((el) =>
        el.textContent?.trim()
      )
    ).toEqual(['vue', '3.5']);
  });
});
