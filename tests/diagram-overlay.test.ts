import { afterEach, expect, test } from 'bun:test';

import { Window } from 'happy-dom';
import { defineComponent, h, nextTick } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });

let renderedSvg = '<svg viewBox="0 0 120 60"><g /></svg>';
const mermaid = {
  initialize() {},
  parse: async () => true,
  render: async () => ({ svg: renderedSvg }),
};

const Overlay = await compileVue(
  'app/components/ui/DiagramOverlay.vue',
  {
    '@lucide/vue': { MinusIcon: icon, PlusIcon: icon, XIcon: icon },
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

async function createOverlayDom() {
  // `instanceof SVGSVGElement` in the component needs the global; the helper captures its
  // globals before it builds its window, so borrow the real constructor from a probe window.
  const probe = new Window();
  const { SVGSVGElement } = probe;
  await probe.happyDOM.close();
  return createVueDom({ SVGSVGElement });
}

async function mountOverlay(
  onClose: () => void = () => {},
  svg = '<svg viewBox="0 0 120 60"><g /></svg>'
) {
  dom = await createOverlayDom();
  renderedSvg = svg;
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h('div', { class: 'simplebar-mask' }, [
          h(Overlay as never, { code: 'graph TD; A-->B;', onClose }),
        ]),
    })
  );
  const visibilityAtMeasurement: string[] = [];
  const viewport = dom.document.querySelector<HTMLElement>('.diagram-overlay__viewport')!;
  viewport.getBoundingClientRect = () => {
    const diagram = dom.document.querySelector<HTMLElement>('.diagram-overlay__diagram');
    if (diagram) visibilityAtMeasurement.push(diagram.style.visibility);
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1024,
      bottom: 768,
      width: 1024,
      height: 768,
      toJSON() {},
    };
  };
  // The mermaid import and the post-render fit both resolve across microtasks.
  await nextTick();
  await Bun.sleep(0);
  await nextTick();

  return { document: dom.document, root: view.root, visibilityAtMeasurement };
}

function zoomReadout(document: Document) {
  return document.querySelector('[aria-label^="markdown.mermaid.fit"]')?.textContent?.trim() ?? '';
}

test('the overlay mounts on the document body instead of the pane scroll context', async () => {
  // The detail pane's main column is a SimpleBar scroll area whose mask owns a
  // z-index:0 stacking context, and the Detail Sidebar is painted after it in
  // the same grid. Mounting the dialog inside that column caps it below the
  // sidebar, so the overlay must render outside the pane entirely.
  const { document, root } = await mountOverlay();
  const modal = document.querySelector<HTMLElement>('.diagram-overlay');

  expect(modal).not.toBeNull();
  expect(modal!.parentElement).toBe(document.body);
  expect(root.querySelector('.diagram-overlay')).toBeNull();
  expect(modal!.closest('.simplebar-mask')).toBeNull();
});

test('the overlay offers exactly one close control', async () => {
  const { document } = await mountOverlay();
  const closeKey = 'markdown.mermaid.close';
  const dismissals = Array.from(document.querySelectorAll('button')).filter(
    (button) =>
      button.getAttribute('aria-label') === closeKey || button.textContent?.trim() === closeKey
  );

  expect(dismissals).toHaveLength(1);
});

test('the close control asks the parent to close the overlay', async () => {
  let closes = 0;
  const { document } = await mountOverlay(() => {
    closes += 1;
  });

  document.querySelector<HTMLElement>('[aria-label="markdown.mermaid.close"]')!.click();

  expect(closes).toBe(1);
});

test('Escape asks the parent to close the overlay', async () => {
  let closes = 0;
  const { document } = await mountOverlay(() => {
    closes += 1;
  });

  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));

  expect(closes).toBe(1);
});

test('the dialog is named by the visually hidden diagram title', async () => {
  const { document } = await mountOverlay();
  const dialog = document.querySelector('[role="dialog"]');
  const labelledBy = dialog?.getAttribute('aria-labelledby') ?? '';
  const title = labelledBy ? document.getElementById(labelledBy) : null;

  expect(title?.textContent?.trim()).toBe('markdown.mermaid.title');
});

test('the percentage readout zooms in and returns to fit when clicked', async () => {
  const { document } = await mountOverlay();
  const fitted = zoomReadout(document);

  document.querySelector<HTMLElement>('[aria-label="markdown.mermaid.zoomIn"]')!.click();
  await nextTick();
  expect(zoomReadout(document)).not.toBe(fitted);

  document.querySelector<HTMLElement>('[aria-label^="markdown.mermaid.fit"]')!.click();
  await nextTick();
  expect(zoomReadout(document)).toBe(fitted);
});

test('the SVG stays hidden until its initial viewport has been measured', async () => {
  const { document, visibilityAtMeasurement } = await mountOverlay();
  expect(visibilityAtMeasurement[0]).toBe('hidden');
  const diagram = document.querySelector<HTMLElement>('.diagram-overlay__diagram')!;
  expect(diagram.querySelector('svg')).not.toBeNull();
  expect(diagram.style.visibility).toBe('visible');
  expect(zoomReadout(document)).toBe('100%');
});

test('large diagrams open at 75% from their start while Fit still shows the whole diagram', async () => {
  const { document } = await mountOverlay(() => {}, '<svg viewBox="0 0 2000 3000"><g /></svg>');
  expect(zoomReadout(document)).toBe('75%');
  const diagram = document.querySelector<HTMLElement>('.diagram-overlay__diagram')!;
  expect(diagram.style.transform).toBe('translate(278px, 805px) scale(0.75)');

  document.querySelector<HTMLElement>('[aria-label^="markdown.mermaid.fit"]')!.click();
  await nextTick();
  expect(zoomReadout(document)).toBe('20%');
  expect(diagram.style.transform).toContain('translate(0px, 0px)');
});

test('the readout announces both the fit action and the current zoom', async () => {
  const { document } = await mountOverlay();
  const readout = document.querySelector('[aria-label^="markdown.mermaid.fit"]');

  expect(readout?.getAttribute('aria-label')).toBe(
    `markdown.mermaid.fit (${zoomReadout(document)})`
  );
});

test('clicking the canvas does not close the overlay', async () => {
  let closes = 0;
  const { document } = await mountOverlay(() => {
    closes += 1;
  });

  document.querySelector<HTMLElement>('.diagram-overlay__viewport')!.click();
  await nextTick();

  expect(closes).toBe(0);
});

test('two pointers moving apart zoom the diagram', async () => {
  const { document } = await mountOverlay();
  const viewport = document.querySelector<HTMLElement>('.diagram-overlay__viewport')!;
  const fitted = zoomReadout(document);

  const pointer = (type: string, pointerId: number, clientX: number) =>
    new dom.window.PointerEvent(type, {
      pointerId,
      pointerType: 'touch',
      clientX,
      clientY: 120,
      button: 0,
    });

  viewport.dispatchEvent(pointer('pointerdown', 1, 100));
  viewport.dispatchEvent(pointer('pointerdown', 2, 200));
  viewport.dispatchEvent(pointer('pointermove', 2, 300));
  await nextTick();

  expect(zoomReadout(document)).not.toBe(fitted);

  viewport.dispatchEvent(pointer('pointerup', 1, 100));
  viewport.dispatchEvent(pointer('pointerup', 2, 300));
  await nextTick();
});
