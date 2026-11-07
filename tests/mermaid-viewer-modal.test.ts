import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';
import { defineComponent, h, nextTick } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });

const mermaid = {
  initialize() {},
  parse: async () => true,
  render: async () => ({ svg: '<svg viewBox="0 0 120 60"><g /></svg>' }),
};

const Viewer = await compileVue(
  'app/components/ui/MermaidViewerModal.vue',
  {
    '@lucide/vue': { MinusIcon: icon, PlusIcon: icon, RotateCcwIcon: icon, XIcon: icon },
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    mermaid: { default: mermaid },
    'test/stubs': {
      useModalState: () => ({ openModal() {}, closeModal() {} }),
      useColorMode: () => ({ value: 'light' }),
      createFocusTrapController: () => ({
        capturePreviousFocus() {},
        restorePreviousFocus() {},
        trapTabKey() {},
      }),
    },
  },
  {
    useI18n: 'vue-i18n',
    useModalState: 'test/stubs',
    useColorMode: 'test/stubs',
    createFocusTrapController: 'test/stubs',
  }
);

let dom: ReturnType<typeof createVueDom>;

afterEach(async () => {
  await dom?.cleanup();
});

test('the viewer mounts on the document body instead of the pane scroll context', async () => {
  // The detail pane's main column is a SimpleBar scroll area whose mask owns a
  // z-index:0 stacking context, and the Detail Sidebar is painted after it in
  // the same grid. Mounting the dialog inside that column caps it below the
  // sidebar, so the viewer must render outside the pane entirely.
  //
  // `instanceof SVGSVGElement` in the component needs the global; the helper
  // captures its globals before it builds its window, so borrow the real
  // constructor from a probe window and close it.
  const probe = new Window();
  const { SVGSVGElement } = probe;
  await probe.happyDOM.close();
  dom = createVueDom({ SVGSVGElement });
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h('div', { class: 'simplebar-mask' }, [h(Viewer as never, { code: 'graph TD; A-->B;' })]),
    })
  );

  await nextTick();
  await Bun.sleep(0);
  await nextTick();

  const modal = dom.document.querySelector<HTMLElement>('.mermaid-viewer-modal');
  expect(modal).not.toBeNull();
  expect(modal!.parentElement).toBe(dom.document.body);
  expect(view.root.querySelector('.mermaid-viewer-modal')).toBeNull();
  expect(modal!.closest('.simplebar-mask')).toBeNull();
});
