import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useReleaseOverlaySheet } from '../app/composables/useReleaseOverlaySheet';
import { createVueDom } from './helpers/vue-dom';

let dom: ReturnType<typeof createVueDom>;
beforeEach(() => {
  dom = createVueDom();
});
afterEach(async () => {
  await dom.cleanup();
});

function harness() {
  const open = shallowRef(true);
  let sheet!: ReturnType<typeof useReleaseOverlaySheet>;
  const mounted = dom.mount(
    defineComponent({
      setup() {
        sheet = useReleaseOverlaySheet({
          open,
          onRequestClose: () => {
            open.value = false;
          },
        });
        return () =>
          h(
            'header',
            {
              onPointerdown: sheet.onPointerDown,
              onPointermove: sheet.onPointerMove,
              onPointerup: sheet.onPointerUp,
              onPointercancel: sheet.onPointerCancel,
              onLostpointercapture: sheet.onPointerCancel,
            },
            [h('button', 'Close')]
          );
      },
    })
  );
  const handle = mounted.root.querySelector('header')!;
  const pointer = (type: string, y: number, pointerId = 1, target: Element = handle) => {
    target.dispatchEvent(
      new dom.window.PointerEvent(type, {
        clientY: y,
        pointerId,
        button: 0,
        bubbles: true,
      }) as unknown as Event
    );
  };
  return { ...mounted, open, sheet, handle, pointer };
}

describe('Release overlay sheet gestures', () => {
  test('close and reopen reset expansion and reject a stale pointer release', () => {
    const view = harness();
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 0);
    view.pointer('pointerdown', 100);
    view.open.value = false;
    view.open.value = true;
    view.pointer('pointerup', 200);
    expect(view.open.value).toBe(true);
    expect(view.sheet.expanded.value).toBe(false);
    expect(view.sheet.dragging.value).toBe(false);
  });

  test('buttons, desktop dragging and unrelated pointers do not trigger sheet gestures', () => {
    const view = harness();
    view.pointer('pointerdown', 100, 1, view.handle.querySelector('button')!);
    view.pointer('pointerup', 200);
    expect(view.open.value).toBe(true);
    expect(view.sheet.dragging.value).toBe(false);
    dom.window.happyDOM.setViewport({ width: 1200 });
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 200);
    expect(view.open.value).toBe(true);
    dom.window.happyDOM.setViewport({ width: 390 });
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 200, 2);
    expect(view.open.value).toBe(true);
    expect(view.sheet.dragging.value).toBe(true);
    view.pointer('lostpointercapture', 200);
    expect(view.sheet.dragging.value).toBe(false);
    expect(view.open.value).toBe(true);
  });

  test('unmount cancels an active drag', () => {
    const view = harness();
    view.pointer('pointerdown', 100);
    view.pointer('pointermove', 140);
    view.unmount();
    expect(view.sheet.dragging.value).toBe(false);
    expect(view.sheet.panelStyle.value.transform).toBeUndefined();
    expect(view.open.value).toBe(true);
  });
  test('crossing 860px cancels a drag and returning to mobile starts collapsed', () => {
    const view = harness();
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 0);
    expect(view.sheet.expanded.value).toBe(true);
    view.pointer('pointerdown', 100);
    view.pointer('pointermove', 120);
    // Happy DOM initializes MediaQueryList's previous match to false, even on mobile.
    dom.window.dispatchEvent(new dom.window.Event('resize'));
    dom.window.happyDOM.setViewport({ width: 861 });
    expect(view.sheet.expanded.value).toBe(false);
    expect(view.sheet.dragging.value).toBe(false);
    view.pointer('pointerup', 200);
    expect(view.open.value).toBe(true);
    dom.window.happyDOM.setViewport({ width: 860 });
    expect(view.sheet.panelStyle.value.height).toBeUndefined();
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 0);
    expect(view.sheet.expanded.value).toBe(true);
  });
  test('pointer cancellation discards movement without closing or expanding', () => {
    const view = harness();
    view.pointer('pointerdown', 100);
    view.pointer('pointermove', 200);
    view.pointer('pointercancel', 200);
    expect(view.open.value).toBe(true);
    expect(view.sheet.dragging.value).toBe(false);
    expect(view.sheet.panelStyle.value.transform).toBeUndefined();
    view.pointer('pointerdown', 100);
    view.pointer('pointercancel', 0);
    expect(view.sheet.expanded.value).toBe(false);
  });
  test('expands, collapses and dismisses using the existing drag thresholds', async () => {
    const view = harness();
    view.pointer('pointerdown', 100);
    view.pointer('pointermove', 40);
    expect(view.sheet.panelStyle.value.height).toBe('calc(70vh + 60px)');
    view.pointer('pointerup', 40);
    expect(view.sheet.expanded.value).toBe(true);
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 148);
    expect(view.sheet.expanded.value).toBe(false);
    view.pointer('pointerdown', 100);
    view.pointer('pointerup', 180);
    await nextTick();
    expect(view.open.value).toBe(false);
    expect(view.sheet.dragging.value).toBe(false);
  });
});
