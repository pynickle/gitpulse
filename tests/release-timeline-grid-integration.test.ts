import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import buildReleaseTimelineGridRows from '../app/utils/buildReleaseTimelineGridRows';
import resolveReleaseTimelineVisibleRange from '../app/utils/resolveReleaseTimelineVisibleRange';
import type { TimelineRelease } from '../shared/types/release-follows';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';
const Card = defineComponent({
  props: ['item'],
  setup: (props) => () => h('button', { 'data-release': props.item.id }, props.item.title),
});
const Grid = await compileVue('app/components/dashboard/release-timeline/ReleaseTimelineGrid.vue', {
  '~/components/dashboard/release-timeline/ReleaseTimelineCard.vue': { default: Card },
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
      const scroller = dom.document.querySelector<HTMLElement>('.release-timeline-grid');
      if (this.classList.contains('release-timeline-grid')) return rect(0, 400) as DOMRect;
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
    dom.mount(defineComponent({ setup: () => () => h(Grid, { groups: groups.value }) }));
    await flush();
    const scroller = dom.document.querySelector<HTMLElement>('.release-timeline-grid')!;
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
