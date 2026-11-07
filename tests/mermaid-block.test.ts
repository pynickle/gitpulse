import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick } from 'vue';

import { estimateMermaidPreviewHeight } from '../shared/utils/mermaid-preview-height';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const Block = await compileVue(
  'app/components/ui/MermaidBlock.vue',
  {
    '@lucide/vue': { Maximize2Icon: defineComponent({ setup: () => () => h('svg') }) },
    '#shared/utils/mermaid-preview-height': { estimateMermaidPreviewHeight },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/components/ui/DiagramOverlay.vue': {
      default: defineComponent({
        emits: ['close'],
        setup:
          (_, { emit }) =>
          () =>
            h('button', { class: 'close-overlay', onClick: () => emit('close') }, 'Close'),
      }),
    },
    mermaid: {
      default: {
        initialize() {},
        parse: async () => true,
        render: async () => ({ svg: '<svg viewBox="0 0 120 60"><g /></svg>' }),
      },
    },
    'test/stubs': {
      ClientOnly: defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            slots.default?.(),
      }),
      useI18n: () => ({ t: (key: string) => key }),
      useColorMode: () => ({ value: 'light' }),
    },
  },
  { ClientOnly: 'test/stubs', useI18n: 'test/stubs', useColorMode: 'test/stubs' }
);

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom?.cleanup();
});

async function mountBlock(width: number) {
  dom = createVueDom();
  dom.window.happyDOM.setWindowSize({ width, height: 844 });
  const { root } = dom.mount(
    defineComponent({ setup: () => () => h(Block, { code: 'graph TD; A-->B' }) })
  );
  await Bun.sleep(0);
  await nextTick();
  return root;
}

test('wide preview opens only from its existing Open diagram button', async () => {
  const root = await mountBlock(1024);
  const preview = root.querySelector<HTMLElement>('.mermaid-preview')!;
  expect(preview.tagName).toBe('DIV');
  preview.click();
  await nextTick();
  expect(root.querySelector('.close-overlay')).toBeNull();

  root.querySelector<HTMLButtonElement>('.mermaid-block__open')!.click();
  await nextTick();
  expect(root.querySelector('.close-overlay')).not.toBeNull();
});

test('narrow Diagram Preview is a named native button and regains focus after closing', async () => {
  const root = await mountBlock(640);
  const preview = root.querySelector<HTMLButtonElement>('.mermaid-preview')!;
  expect(preview.tagName).toBe('BUTTON');
  expect(preview.type).toBe('button');
  expect(preview.getAttribute('aria-label')).toBe('markdown.mermaid.open');
  preview.click();
  await nextTick();
  root.querySelector<HTMLButtonElement>('.close-overlay')!.click();
  await nextTick();
  await nextTick();
  expect(root.querySelector('.close-overlay')).toBeNull();
  expect(dom.document.activeElement).toBe(preview);
});

test('resizing across 640px switches preview activation without remounting the diagram', async () => {
  const root = await mountBlock(641);
  expect(root.querySelector('.mermaid-preview')!.tagName).toBe('DIV');
  dom.window.happyDOM.setWindowSize({ width: 640, height: 844 });
  await nextTick();
  expect(root.querySelector('.mermaid-preview')!.tagName).toBe('BUTTON');
  dom.window.happyDOM.setWindowSize({ width: 641, height: 844 });
  await nextTick();
  expect(root.querySelector('.mermaid-preview')!.tagName).toBe('DIV');
});
