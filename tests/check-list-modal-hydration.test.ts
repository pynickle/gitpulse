import { afterEach, expect, test } from 'bun:test';

import { renderToString } from '@vue/server-renderer';
import { createSSRApp, defineComponent, h, nextTick } from 'vue';

import * as checks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const i18n = { useI18n: () => ({ t: (key: string) => key }) };
const CheckListRows = await compileVue(
  'app/components/dashboard/pr/CheckListRows.vue',
  { 'test/i18n': i18n },
  { useI18n: 'test/i18n' }
);
const CheckListModal = await compileVue(
  'app/components/dashboard/pr/CheckListModal.vue',
  {
    '@lucide/vue': { XIcon: icon },
    '#shared/utils/pr-checks': checks,
    '~/components/dashboard/pr/CheckListRows.vue': { default: CheckListRows },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/i18n': i18n,
    'test/icons': { getCheckStatusToneIcon: () => icon },
  },
  { useI18n: 'test/i18n', getCheckStatusToneIcon: 'test/icons' }
);

const view = checks.toPullRequestChecksView({
  state: 'SUCCESS',
  contexts: {
    totalCount: 1,
    nodes: [
      {
        name: 'Unit tests',
        conclusion: 'SUCCESS',
        status: 'COMPLETED',
        detailsUrl: 'https://github.com/octo/app/actions/runs/1',
      },
    ],
  },
});

const host = () =>
  defineComponent({
    setup: () => () => h(CheckListModal, { isVisible: false, view }),
  });

const renderServerHtml = async () => {
  const context: Record<string, unknown> = {};
  const html = await renderToString(createSSRApp(host()), context);
  return { html, teleports: (context.teleports as Record<string, string> | undefined) ?? {} };
};

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom?.cleanup();
});

test('the dialog renders in place instead of teleporting into the shared body target', async () => {
  const { html, teleports } = await renderServerHtml();

  // Every <Teleport to="body"> on a page shares one target, and Vue chains those
  // hydrations through it in SSR buffer order. A lazy component resolving out of order
  // then consumes a sibling's nodes, which is the logged hydration mismatch.
  expect(teleports.body ?? '').toBe('');
  expect(html).toContain('<dialog');
  expect(html).not.toContain('teleport start');
});

test('hydrating the server markup raises no mismatch warning', async () => {
  dom = createVueDom();
  // The SSR mount path resolves its root namespace by instanceof-checking SVGElement.
  Object.assign(globalThis, { SVGElement: dom.window.SVGElement });
  dom.document.body.innerHTML = (await renderServerHtml()).html;

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  try {
    createSSRApp(host()).mount(dom.document.body);
    await nextTick();
    await Bun.sleep(0);
  } finally {
    console.warn = originalWarn;
  }

  expect(warnings.filter((warning) => /hydration/i.test(warning))).toEqual([]);
  expect(dom.document.querySelector('dialog')?.getAttribute('aria-label')).toBe(
    'dashboard.checks.modalTitle'
  );
});
