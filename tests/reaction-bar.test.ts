import { afterAll, afterEach, beforeEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import type { ReactionSummaryItem, ReactionSummaryPayload } from '#shared/types/reactions';

import english from '../i18n/locales/en.json';
import chinese from '../i18n/locales/zh-cn.json';
import * as reactionsUtils from '../shared/utils/reactions';
import { compileVue } from './helpers/compile-vue';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

const catalogs = { en: english, 'zh-cn': chinese };
const locale = shallowRef<keyof typeof catalogs>('zh-cn');

function translate(
  catalog: (typeof catalogs)[keyof typeof catalogs],
  key: string,
  params?: Record<string, unknown>
) {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, catalog);
  if (typeof value !== 'string') {
    throw new Error(`Missing translation ${key}`);
  }
  return interpolateTranslation(value, params);
}

const iconStub = defineComponent({ setup: () => () => h('span') });
const fetchCalls: Array<{ url: string; options?: Record<string, unknown> }> = [];
let fetchImpl: (
  url: string,
  options?: Record<string, unknown>
) => Promise<ReactionSummaryPayload> = async () => ({ items: [] });

const ReactionBar = await compileVue('app/components/dashboard/reactions/ReactionBar.vue', {
  '@lucide/vue': {
    CircleAlertIcon: iconStub,
    FaceSlightlySmilingPlusIcon: iconStub,
    InfoIcon: iconStub,
    LoaderCircleIcon: iconStub,
    XIcon: iconStub,
  },
  '#shared/utils/reactions': reactionsUtils,
  'vue-i18n': {
    useI18n: () => ({
      locale,
      t: (key: string, params?: Record<string, unknown>) =>
        translate(catalogs[locale.value], key, params),
    }),
  },
});

const dom = createVueDom({
  useGitPulseApiFetch: () => (url: string, options?: Record<string, unknown>) => {
    fetchCalls.push({ url, options });
    return fetchImpl(url, options);
  },
});

const sampleItems: ReactionSummaryItem[] = [
  { content: '+1', count: 3, viewerHasReacted: false, viewerReactionId: null },
];

async function flushUi() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

beforeEach(() => {
  locale.value = 'zh-cn';
  fetchCalls.length = 0;
  fetchImpl = async () => ({ items: sampleItems });
});

afterEach(() => {
  dom.document.body.innerHTML = '';
});

afterAll(() => dom.cleanup());

test('canReact: false disables the add button and existing chips with accurate titles and no inline notice', async () => {
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(ReactionBar, {
          targetKind: 'issue-comment',
          owner: 'octo',
          repo: 'widgets',
          targetId: 42,
          initialItems: sampleItems,
          initialItemsIncludeViewerState: true,
          canReact: false,
        }),
    })
  );
  await flushUi();

  const chip = dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip');
  const add = dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add');
  const feedback = dom.document.querySelector('.reaction-bar__feedback');

  expect(chip?.disabled).toBe(true);
  expect(chip?.textContent).toContain('3');
  expect(chip?.getAttribute('title')).toContain('无法添加表情');
  expect(add?.disabled).toBe(true);
  expect(add?.getAttribute('title')).toBe('无法添加表情');
  expect(add?.getAttribute('aria-label')).toBe('无法添加表情');
  expect(Boolean(feedback)).toBe(false);
  expect(fetchCalls).toHaveLength(0);

  mounted.unmount();
});

test('undefined canReact stays interactive and selecting an emoji closes the popover', async () => {
  fetchImpl = async (_url, options) => {
    if (options?.method === 'POST') {
      return {
        items: [{ content: '+1', count: 4, viewerHasReacted: true, viewerReactionId: 9 }],
        canReact: true,
      };
    }
    return { items: sampleItems, canReact: true };
  };

  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(ReactionBar, {
          targetKind: 'issue-comment',
          owner: 'octo',
          repo: 'widgets',
          targetId: 42,
          initialItems: sampleItems,
          initialItemsIncludeViewerState: true,
        }),
    })
  );
  await flushUi();

  const add = dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add');
  expect(add?.disabled).toBe(false);
  add?.click();
  await flushUi();
  expect(Boolean(dom.document.querySelector('.reaction-bar__popover'))).toBe(true);

  const option = dom.document.querySelector<HTMLButtonElement>('.reaction-bar__option');
  option?.click();
  await flushUi();

  expect(Boolean(dom.document.querySelector('.reaction-bar__popover'))).toBe(false);
  expect(dom.document.querySelector('.reaction-bar__chip')?.textContent).toContain('4');
  mounted.unmount();
});

test('ordinary write failure rolls back, closes the popover, and renders a dismissible role=alert banner', async () => {
  fetchImpl = async () => {
    throw new Error('network down');
  };

  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(ReactionBar, {
          targetKind: 'issue-comment',
          owner: 'octo',
          repo: 'widgets',
          targetId: 42,
          initialItems: sampleItems,
          initialItemsIncludeViewerState: true,
          canReact: true,
        }),
    })
  );
  await flushUi();

  dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add')?.click();
  await flushUi();
  dom.document.querySelector<HTMLButtonElement>('.reaction-bar__option')?.click();
  await flushUi();

  expect(Boolean(dom.document.querySelector('.reaction-bar__popover'))).toBe(false);
  expect(dom.document.querySelector('.reaction-bar__chip')?.textContent).toContain('3');

  const alert = dom.document.querySelector<HTMLElement>('.reaction-bar__feedback[role="alert"]');
  expect(Boolean(alert)).toBe(true);
  expect(alert?.textContent).toContain('更新表情失败');
  expect(alert?.classList.contains('reaction-bar__feedback--error')).toBe(true);

  const dismiss = alert?.querySelector<HTMLButtonElement>('.reaction-bar__feedback-dismiss');
  expect(Boolean(dismiss)).toBe(true);
  dismiss?.click();
  await flushUi();
  expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(false);

  mounted.unmount();
});

test('runtime reaction_forbidden disables controls and shows a muted cannot-react notice instead of updateFailed', async () => {
  const emittedCanReact: boolean[] = [];
  fetchImpl = async () => {
    throw {
      statusCode: 403,
      data: {
        data: {
          code: reactionsUtils.REACTION_FORBIDDEN_ERROR_CODE,
          canReact: false,
        },
      },
    };
  };

  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(ReactionBar, {
          targetKind: 'issue-comment',
          owner: 'octo',
          repo: 'widgets',
          targetId: 42,
          initialItems: sampleItems,
          initialItemsIncludeViewerState: true,
          canReact: true,
          'onUpdate:canReact': (value: boolean) => emittedCanReact.push(value),
        }),
    })
  );
  await flushUi();

  dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.click();
  await flushUi();

  expect(emittedCanReact).toEqual([false]);
  expect(dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add')?.disabled).toBe(true);
  expect(dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.disabled).toBe(true);

  const notice = dom.document.querySelector<HTMLElement>('.reaction-bar__feedback[role="status"]');
  expect(Boolean(notice)).toBe(true);
  expect(notice?.classList.contains('reaction-bar__feedback--muted')).toBe(true);
  expect(notice?.textContent).toContain('无法添加表情');
  expect(notice?.textContent).not.toContain('更新表情失败');

  mounted.unmount();
});

test('deferred viewer state discovery of canReact: false closes the popover, disables controls, and shows a muted notice', async () => {
  fetchImpl = async () => ({
    items: sampleItems,
    canReact: false,
  });

  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(ReactionBar, {
          targetKind: 'issue-comment',
          owner: 'octo',
          repo: 'widgets',
          targetId: 42,
          initialItems: sampleItems,
          deferViewerState: true,
        }),
    })
  );
  await flushUi();

  const add = dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add');
  expect(add?.disabled).toBe(false);
  add?.click();
  await flushUi();

  expect(Boolean(dom.document.querySelector('.reaction-bar__popover'))).toBe(false);
  expect(dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add')?.disabled).toBe(true);
  expect(dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.disabled).toBe(true);
  const notice = dom.document.querySelector<HTMLElement>('.reaction-bar__feedback[role="status"]');
  expect(Boolean(notice)).toBe(true);
  expect(notice?.textContent).toContain('无法添加表情');

  mounted.unmount();
});

test('feedback auto-clears after 5s, clears on next click or target change, and cleans up timer on unmount', async () => {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const timers = new Map<number, { fn: () => void; delay: number }>();
  const clearedIds: number[] = [];
  let nextTimerId = 1;

  globalThis.setTimeout = ((fn: () => void, delay?: number) => {
    const id = nextTimerId++;
    timers.set(id, { fn, delay: Number(delay ?? 0) });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
    const numericId = Number(id);
    clearedIds.push(numericId);
    timers.delete(numericId);
  }) as typeof clearTimeout;

  try {
    const targetId = shallowRef(42);
    fetchImpl = async () => {
      throw new Error('network down');
    };

    const mounted = dom.mount(
      defineComponent({
        setup: () => () =>
          h(ReactionBar, {
            targetKind: 'issue-comment',
            owner: 'octo',
            repo: 'widgets',
            targetId: targetId.value,
            initialItems: sampleItems,
            initialItemsIncludeViewerState: true,
            canReact: true,
          }),
      })
    );
    await flushUi();

    // Trigger failure -> schedules 5000ms auto-clear timer.
    dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.click();
    await flushUi();
    expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(true);
    const firstTimer = [...timers.entries()][0];
    expect(firstTimer?.[1].delay).toBe(5000);
    if (firstTimer) {
      timers.delete(firstTimer[0]);
      firstTimer[1].fn();
    }
    await flushUi();
    expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(false);

    // Trigger failure again -> opening '+' clears feedback immediately.
    dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.click();
    await flushUi();
    expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(true);
    dom.document.querySelector<HTMLButtonElement>('.reaction-bar__add')?.click();
    await flushUi();
    expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(false);

    // Trigger failure again -> switching target clears feedback immediately.
    dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.click();
    await flushUi();
    expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(true);
    targetId.value = 99;
    await flushUi();
    expect(Boolean(dom.document.querySelector('.reaction-bar__feedback'))).toBe(false);

    // Trigger failure again -> unmounting clears active timer.
    dom.document.querySelector<HTMLButtonElement>('.reaction-bar__chip')?.click();
    await flushUi();
    const pendingId = [...timers.keys()][0]!;
    mounted.unmount();
    expect(clearedIds).toContain(pendingId);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    globalThis.clearTimeout = realClearTimeout;
  }
});
