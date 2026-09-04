<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from 'vue';

import type { ReleaseTimelineGroup, TimelineRelease } from '#shared/types/release-follows';
import ReleaseTimelineCard from '~/components/dashboard/release-timeline/ReleaseTimelineCard.vue';

const DATE_ROW_ESTIMATED_HEIGHT = 48;
const CARD_ROW_ESTIMATED_HEIGHT = 182;
const OVERSCAN_PX = 720;
const OVERSCAN_ROWS = 2;
const MIN_VISIBLE_ROWS = 4;

const props = defineProps<{
  groups: ReleaseTimelineGroup[];
  scrollLocked?: boolean;
}>();

const emit = defineEmits<{
  open: [item: TimelineRelease];
}>();

const { stateFor, expand } = useReleaseTimelineExpansion();

const scroller = useTemplateRef<HTMLElement>('scroller');
const rowsRoot = useTemplateRef<HTMLElement>('rowsRoot');
const columnCount = shallowRef(resolveReleaseTimelineColumnCount(Number.POSITIVE_INFINITY));
const visibleRange = shallowRef({ start: 0, end: MIN_VISIBLE_ROWS });
const measuredRowHeights = shallowRef(new Map<string, number>());
const rowElements = new Map<string, HTMLElement>();
const pendingMeasuredHeights = new Map<string, number>();

let rowResizeObserver: ResizeObserver | undefined;
let viewportResizeObserver: ResizeObserver | undefined;
let phoneMedia: MediaQueryList | undefined;
let tabletMedia: MediaQueryList | undefined;
let updateFrame: number | undefined;
let measurementFrame: number | undefined;

const rows = computed(() => buildReleaseTimelineGridRows(props.groups, columnCount.value));

const getEstimatedRowHeight = (type: 'date' | 'cards') =>
  type === 'date' ? DATE_ROW_ESTIMATED_HEIGHT : CARD_ROW_ESTIMATED_HEIGHT;

const rowMetrics = computed(() => {
  let top = 0;

  return rows.value.map((row) => {
    const height = measuredRowHeights.value.get(row.key) ?? getEstimatedRowHeight(row.type);
    const metric = { row, key: row.key, top, height };
    top += height;
    return metric;
  });
});

const totalHeight = computed(() => {
  const metrics = rowMetrics.value;
  const last = metrics.at(-1);
  return last ? last.top + last.height : 0;
});

const visibleRows = computed(() => {
  const start = Math.min(visibleRange.value.start, rowMetrics.value.length);
  const end = Math.min(visibleRange.value.end, rowMetrics.value.length);
  return rowMetrics.value.slice(start, end).map((virtualRow) => ({
    ...virtualRow,
    cards:
      virtualRow.row.type === 'cards'
        ? virtualRow.row.items.map((item) => ({
            item,
            ...stateFor(item),
          }))
        : [],
  }));
});

const topSpacerHeight = computed(() => visibleRows.value[0]?.top ?? 0);

const bottomSpacerHeight = computed(() => {
  const last = visibleRows.value.at(-1);
  if (!last) {
    return totalHeight.value;
  }
  return Math.max(0, totalHeight.value - last.top - last.height);
});

const setVisibleRange = (start: number, end: number) => {
  if (visibleRange.value.start === start && visibleRange.value.end === end) {
    return;
  }
  visibleRange.value = { start, end };
};

const syncVisibleRows = async () => {
  await nextTick();

  const root = rowsRoot.value;
  const container = scroller.value;
  const metrics = rowMetrics.value;

  if (!root || !container || metrics.length === 0) {
    setVisibleRange(0, Math.min(MIN_VISIBLE_ROWS, rows.value.length));
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (containerRect.height <= 0) {
    setVisibleRange(0, Math.min(MIN_VISIBLE_ROWS, metrics.length));
    return;
  }

  const range = resolveReleaseTimelineVisibleRange({
    metrics,
    viewportTop: containerRect.top - rootRect.top,
    viewportBottom: containerRect.bottom - rootRect.top,
    overscanPx: OVERSCAN_PX,
    overscanRows: OVERSCAN_ROWS,
    minVisibleRows: MIN_VISIBLE_ROWS,
  });

  setVisibleRange(range.start, range.end);
};

const scheduleVisibleRowsSync = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (updateFrame) {
    window.cancelAnimationFrame(updateFrame);
  }

  updateFrame = window.requestAnimationFrame(() => {
    updateFrame = undefined;
    void syncVisibleRows();
  });
};

const flushMeasuredHeights = () => {
  measurementFrame = undefined;

  if (!pendingMeasuredHeights.size) {
    return;
  }

  let changed = false;
  const nextHeights = new Map(measuredRowHeights.value);

  for (const [rowKey, measuredHeight] of pendingMeasuredHeights) {
    if (measuredHeight > 0 && nextHeights.get(rowKey) !== measuredHeight) {
      nextHeights.set(rowKey, measuredHeight);
      changed = true;
    }
  }

  pendingMeasuredHeights.clear();

  if (!changed) {
    return;
  }

  measuredRowHeights.value = nextHeights;
  scheduleVisibleRowsSync();
};

const queueMeasuredRowHeight = (rowKey: string, height: number) => {
  const measuredHeight = Math.ceil(height);
  if (measuredHeight <= 0) {
    return;
  }

  pendingMeasuredHeights.set(rowKey, measuredHeight);

  if (typeof window === 'undefined' || measurementFrame) {
    return;
  }

  measurementFrame = window.requestAnimationFrame(flushMeasuredHeights);
};

const applyMeasuredHeights = (entries: ResizeObserverEntry[]) => {
  for (const entry of entries) {
    const target = entry.target;
    if (!(target instanceof HTMLElement)) {
      continue;
    }
    const rowKey = target.dataset.rowKey;
    if (!rowKey) {
      continue;
    }
    queueMeasuredRowHeight(rowKey, target.getBoundingClientRect().height);
  }
};

const setRowElement = (rowKey: string, element: Element | ComponentPublicInstance | null) => {
  const previousElement = rowElements.get(rowKey);
  if (previousElement) {
    rowResizeObserver?.unobserve(previousElement);
    rowElements.delete(rowKey);
  }

  if (!(element instanceof HTMLElement)) {
    return;
  }

  rowElements.set(rowKey, element);
  rowResizeObserver?.observe(element);
  queueMeasuredRowHeight(rowKey, element.getBoundingClientRect().height);
};

const syncColumnCount = () => {
  if (typeof window === 'undefined') {
    return;
  }
  columnCount.value = resolveReleaseTimelineColumnCountFromMedia({
    matches: (query) => window.matchMedia(query).matches,
  });
};

const handleScroll = () => {
  scheduleVisibleRowsSync();
};

const handleBreakpointChange = () => {
  syncColumnCount();
};

watch(columnCount, () => {
  pendingMeasuredHeights.clear();
  measuredRowHeights.value = new Map();
  scheduleVisibleRowsSync();
});

watch(
  () => props.groups,
  () => {
    scheduleVisibleRowsSync();
  }
);

onMounted(() => {
  syncColumnCount();

  if (typeof ResizeObserver !== 'undefined') {
    rowResizeObserver = new ResizeObserver(applyMeasuredHeights);
  }

  phoneMedia = window.matchMedia(RELEASE_TIMELINE_PHONE_MEDIA);
  tabletMedia = window.matchMedia(RELEASE_TIMELINE_TABLET_MEDIA);
  phoneMedia.addEventListener('change', handleBreakpointChange);
  tabletMedia.addEventListener('change', handleBreakpointChange);

  void nextTick(() => {
    rowElements.forEach((element) => rowResizeObserver?.observe(element));

    if (scroller.value && typeof ResizeObserver !== 'undefined') {
      viewportResizeObserver = new ResizeObserver(() => {
        scheduleVisibleRowsSync();
      });
      viewportResizeObserver.observe(scroller.value);
    }

    scheduleVisibleRowsSync();
  });
});

onBeforeUnmount(() => {
  if (updateFrame) {
    window.cancelAnimationFrame(updateFrame);
  }
  if (measurementFrame) {
    window.cancelAnimationFrame(measurementFrame);
  }
  phoneMedia?.removeEventListener('change', handleBreakpointChange);
  tabletMedia?.removeEventListener('change', handleBreakpointChange);
  rowResizeObserver?.disconnect();
  viewportResizeObserver?.disconnect();
});
</script>

<template>
  <div
    ref="scroller"
    class="release-timeline-grid"
    :class="{ 'release-timeline-grid--locked': scrollLocked }"
    @scroll="handleScroll"
  >
    <div ref="rowsRoot" class="release-timeline-grid__rows">
      <div
        v-if="topSpacerHeight"
        class="release-timeline-grid__spacer"
        :style="{ height: `${topSpacerHeight}px` }"
        aria-hidden="true"
      />

      <div
        v-for="virtualRow in visibleRows"
        :key="virtualRow.key"
        :ref="(element) => setRowElement(virtualRow.key, element)"
        class="release-timeline-grid__row"
        :class="`release-timeline-grid__row--${virtualRow.row.type}`"
        :data-row-key="virtualRow.key"
      >
        <div v-if="virtualRow.row.type === 'date'" class="release-timeline-date">
          <span class="release-timeline-date__rule" aria-hidden="true" />
          <time class="release-timeline-date__label" :datetime="virtualRow.row.date">
            {{ virtualRow.row.date }}
          </time>
          <span class="release-timeline-date__rule" aria-hidden="true" />
        </div>

        <div
          v-else
          class="release-timeline-grid__cards"
          :class="`release-timeline-grid__cards--${columnCount}`"
        >
          <ReleaseTimelineCard
            v-for="card in virtualRow.cards"
            :key="card.key"
            :item="card.item"
            :expanded-body="card.expandedBody"
            :expanding="card.expanding"
            :expand-error="card.expandError"
            @open="emit('open', $event)"
            @expand="expand"
          />
        </div>
      </div>

      <div
        v-if="bottomSpacerHeight"
        class="release-timeline-grid__spacer"
        :style="{ height: `${bottomSpacerHeight}px` }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.release-timeline-grid {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
  flex: 1;
  padding: 1rem 1.25rem 1.5rem;
}

.release-timeline-grid--locked {
  overflow: hidden;
}

.release-timeline-grid__rows {
  width: 100%;
}

.release-timeline-grid__row {
  padding-bottom: 0.9rem;
}

.release-timeline-grid__cards {
  display: grid;
  gap: 1rem;
  align-items: stretch;
}

.release-timeline-grid__cards--1 {
  grid-template-columns: minmax(0, 1fr);
}

.release-timeline-grid__cards--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.release-timeline-grid__cards--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.release-timeline-date {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.release-timeline-date__rule {
  flex: 1;
  height: 1px;
  background: var(--gitpulse-border);
}

.release-timeline-date__label {
  flex-shrink: 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

@media (max-width: 700px) {
  .release-timeline-grid {
    padding: 0.85rem 0.9rem 1.25rem;
  }
}
</style>
