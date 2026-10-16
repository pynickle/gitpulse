import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import buildReleaseTimelineGridRows from '../app/utils/buildReleaseTimelineGridRows';
import resolveReleaseTimelineBackToTopFrame, {
  resolveReleaseTimelineBackToTopDurationMs,
} from '../app/utils/resolveReleaseTimelineBackToTopFrame';
import resolveReleaseTimelineVisibleRange from '../app/utils/resolveReleaseTimelineVisibleRange';
import type { TimelineRelease } from '../shared/types/release-follows';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';
const Card = defineComponent({
  props: ['item'],
  setup: (props) => () => h('button', { 'data-release': props.item.id }, props.item.title),
});

test('the production grid reports its viewport and cancels return-to-top motion on user scrolling', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const dom = createVueDom({
    buildReleaseTimelineGridRows,
    resolveReleaseTimelineVisibleRange,
    resolveReleaseTimelineBackToTopFrame,
    resolveReleaseTimelineBackToTopDurationMs,
    resolveReleaseTimelineColumnCount: () => 3,
    resolveReleaseTimelineColumnCountFromMedia: () => 3,
    RELEASE_TIMELINE_PHONE_MEDIA: '(max-width: 700px)',
    RELEASE_TIMELINE_TABLET_MEDIA: '(max-width: 1100px)',
    useI18n: () => ({ t: (key: string) => key }),
  });
  dom.window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  dom.window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const advance = async (time: number) => {
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((callback) => callback(time));
    await nextTick();
  };
  const grid = shallowRef<{ scrollElement: HTMLElement; scrollToTop(): void } | null>(null);
  const positions: { scrollTop: number; viewportHeight: number }[] = [];
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Grid, {
            ref: grid,
            groups: [{ date: '2026-10-10', items: [item(1)] }],
            onViewportScroll: (position: { scrollTop: number; viewportHeight: number }) =>
              positions.push(position),
          }),
      })
    );
    await nextTick();
    await advance(performance.now());
    const viewport = grid.value!.scrollElement;
    Object.defineProperty(viewport, 'clientHeight', { value: 300 });
    viewport.scrollTop = 800;
    viewport.dispatchEvent(new dom.window.Event('scroll'));
    expect(positions.at(-1)).toEqual({ scrollTop: 800, viewportHeight: 300 });
    grid.value!.scrollToTop();
    await advance(performance.now() + 100);
    expect(viewport.scrollTop).toBeLessThan(800);
    expect(viewport.scrollTop).toBeGreaterThan(0);
    viewport.dispatchEvent(new dom.window.Event('wheel'));
    const interrupted = viewport.scrollTop;
    await advance(performance.now() + 2000);
    expect(viewport.scrollTop).toBe(interrupted);
    grid.value!.scrollToTop();
    view.root.firstElementChild!.dispatchEvent(
      new dom.window.PointerEvent('pointerdown', { bubbles: true })
    );
    await advance(performance.now() + 2000);
    expect(viewport.scrollTop).toBe(interrupted);
    grid.value!.scrollToTop();
    await advance(performance.now() + 2000);
    expect(viewport.scrollTop).toBe(0);
  } finally {
    await dom.cleanup();
  }
});
const Grid = await compileVue('app/components/dashboard/release-timeline/ReleaseTimelineGrid.vue', {
  '~/components/dashboard/release-timeline/ReleaseTimelineCard.vue': { default: Card },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
});
const item = (id: number): TimelineRelease => ({
  repository: { id: 'A', owner: 'octo', name: 'A' },
  id,
  tagName: String(id),
  title: String(id),
  publishedAt: `2026-10-10T${String(id % 24).padStart(2, '0')}:00:00Z`,
  changelog: '',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  reactions: [],
});

test('production virtual grid preserves the visible release offset when the same day regroups into columns and rows are measured', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  const grid = shallowRef<{ scrollElement: HTMLElement | null } | null>(null);
  let frameId = 0;
  const dom = createVueDom({
    buildReleaseTimelineGridRows,
    resolveReleaseTimelineVisibleRange,
    resolveReleaseTimelineColumnCount: () => 3,
    resolveReleaseTimelineColumnCountFromMedia: () => 3,
    RELEASE_TIMELINE_PHONE_MEDIA: '(max-width: 700px)',
    RELEASE_TIMELINE_TABLET_MEDIA: '(max-width: 1100px)',
    useI18n: () => ({ t: (key: string) => key }),
  });
  dom.window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  dom.window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await nextTick();
      const batch = [...frames.values()];
      frames.clear();
      for (const callback of batch) callback(0);
    }
  };
  const rect = (top: number, height: number) => ({
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 1200,
    width: 1200,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: HTMLElement): DOMRect {
      const scroller = grid.value?.scrollElement;
      if (this === scroller) return rect(0, 400) as DOMRect;
      if (this.classList.contains('release-timeline-grid__rows'))
        return rect(16 - (scroller?.scrollTop ?? 0), 4000) as DOMRect;
      if (this.classList.contains('release-timeline-grid__row')) {
        let top = 16 - (scroller?.scrollTop ?? 0);
        for (const sibling of Array.from(this.parentElement!.children)) {
          if (sibling === this) break;
          top += (sibling as HTMLElement).style.height
            ? Number.parseFloat((sibling as HTMLElement).style.height)
            : sibling.classList.contains('release-timeline-grid__row--date')
              ? 48
              : 210;
        }
        return rect(
          top,
          this.classList.contains('release-timeline-grid__row--date') ? 48 : 210
        ) as DOMRect;
      }
      return (
        this.closest('.release-timeline-grid__row')?.getBoundingClientRect() ??
        (rect(0, 0) as DOMRect)
      );
    },
  });
  try {
    const groups = shallowRef([
      { date: '2026-10-10', items: Array.from({ length: 60 }, (_, i) => item(i + 1)) },
    ]);
    dom.mount(
      defineComponent({
        setup: () => () =>
          h(Grid, {
            groups: groups.value,
            ref: grid,
          }),
      })
    );
    await flush();
    const scroller = grid.value!.scrollElement!;
    expect(scroller).not.toBe(dom.document.querySelector('.release-timeline-grid'));
    scroller.scrollTop = 1000;
    scroller.dispatchEvent(new dom.window.Event('scroll'));
    await flush();
    const anchor = Array.from(dom.document.querySelectorAll<HTMLElement>('[data-release]')).find(
      (node) => {
        const box = node.getBoundingClientRect();
        return box.top <= 0 && box.bottom > 0;
      }
    )!;
    const id = anchor.dataset.release!;
    const offset = anchor.getBoundingClientRect().top;
    groups.value = [
      {
        date: '2026-10-10',
        items: [item(101), item(102), item(103), item(104), ...groups.value[0]!.items],
      },
    ];
    await flush();
    expect(
      dom.document.querySelector<HTMLElement>(`[data-release="${id}"]`)!.getBoundingClientRect().top
    ).toBe(offset);
  } finally {
    await dom.cleanup();
  }
});

test('the production grid places the previous-refresh marker between publication timestamps', async () => {
  const dom = createVueDom({
    buildReleaseTimelineGridRows,
    resolveReleaseTimelineVisibleRange,
    resolveReleaseTimelineColumnCount: () => 3,
    resolveReleaseTimelineColumnCountFromMedia: () => 3,
    RELEASE_TIMELINE_PHONE_MEDIA: '(max-width: 700px)',
    RELEASE_TIMELINE_TABLET_MEDIA: '(max-width: 1100px)',
    useI18n: () => ({ t: (key: string) => key }),
  });
  try {
    dom.mount(
      defineComponent({
        setup: () => () =>
          h(Grid, {
            groups: [{ date: '2026-10-10', items: [item(15), item(10)] }],
            previousBaseline: '2026-10-10T12:00:00Z',
          }),
      })
    );
    await nextTick();
    const rows = Array.from(dom.document.querySelectorAll('.release-timeline-grid__row'));
    const marker = rows[2]!.querySelector('[role="separator"]');
    expect(rows[1]!.querySelector('[data-release="15"]')).not.toBeNull();
    expect(marker?.textContent?.trim()).toBe('releaseTimeline.previousRefreshMark');
    expect(rows[3]!.querySelector('[data-release="10"]')).not.toBeNull();
  } finally {
    await dom.cleanup();
  }
});
