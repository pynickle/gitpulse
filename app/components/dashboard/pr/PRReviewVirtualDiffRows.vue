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

import PRReviewInlineComment from '~/components/dashboard/pr/PRReviewInlineComment.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import RoundImg from '~/components/ui/RoundImg.vue';
import type { PRReviewCommentThread, PRReviewDiffRow } from '~/composables/usePRReview';
import formatDurationFromNow from '~/utils/formatDurationFromNow';
import tokenizeCodeLine from '~/utils/tokenizeCodeLine';

const VIRTUAL_ROW_THRESHOLD = 120;
const OVERSCAN_PX = 720;
const OVERSCAN_ROWS = 6;
const MIN_VISIBLE_ROWS = 12;
const DIFF_ROW_ESTIMATED_HEIGHT = 26;
const HUNK_ROW_ESTIMATED_HEIGHT = 28;
const INLINE_COMMENT_ESTIMATED_HEIGHT = 180;
const REVIEW_COMMENT_ESTIMATED_HEIGHT = 112;
const CODE_LINE_TOKEN_CACHE_LIMIT = 2048;

interface VirtualRow {
  row: PRReviewDiffRow;
  index: number;
  key: string;
  top: number;
  height: number;
}

type CodeLineTokens = ReturnType<typeof tokenizeCodeLine>;

interface RenderedVirtualRow extends VirtualRow {
  oldTokens: CodeLineTokens;
  newTokens: CodeLineTokens;
  reviewThreads: PRReviewCommentThread[];
  hasActiveDraftTarget: boolean;
}

const props = defineProps<{
  rows: PRReviewDiffRow[];
  filename: string;
  repoOwner: string;
  repoName: string;
  reviewCommentThreads: PRReviewCommentThread[];
  activeDraftTarget: { path: string; line: number } | null;
  activeDraftBody: string;
  submitting: boolean;
  scrollContainer: HTMLElement | null;
}>();

const emit = defineEmits<{
  (e: 'open-draft-editor', path: string, line: number): void;
  (e: 'close-draft-editor'): void;
  (e: 'update-active-draft-body', body: string): void;
  (e: 'save-draft-comment', path: string, line: number, position: number, body: string): void;
}>();

const { t, locale } = useI18n();
const localeCode = computed(() => locale.value);
const rowsRoot = useTemplateRef<HTMLElement>('rowsRoot');
const isRowsNearViewport = shallowRef(false);
const visibleRange = shallowRef({ start: 0, end: 0 });
const measuredRowHeights = shallowRef(new Map<string, number>());
const rowElements = new Map<string, HTMLElement>();
let rowResizeObserver: ResizeObserver | undefined;
let viewportResizeObserver: ResizeObserver | undefined;
let rowsIntersectionObserver: IntersectionObserver | undefined;
let updateFrame: number | undefined;
let measurementFrame: number | undefined;
let scrollListenerTarget: HTMLElement | null = null;
const pendingMeasuredHeights = new Map<string, number>();
const codeLineTokenCache = new Map<string, CodeLineTokens>();

const threadsByLine = computed(() => {
  const threads = new Map<number, PRReviewCommentThread[]>();

  for (const thread of props.reviewCommentThreads) {
    const lineThreads = threads.get(thread.line) ?? [];
    lineThreads.push(thread);
    threads.set(thread.line, lineThreads);
  }

  return threads;
});

const shouldVirtualize = computed(() => props.rows.length > VIRTUAL_ROW_THRESHOLD);
const shouldWindowRows = computed(
  () =>
    shouldVirtualize.value ||
    (typeof IntersectionObserver !== 'undefined' && !isRowsNearViewport.value)
);
const activeDraftLineForFile = computed(() =>
  props.activeDraftTarget?.path === props.filename ? props.activeDraftTarget.line : null
);
const reviewThreadsMeasurementKey = computed(() =>
  JSON.stringify(
    props.reviewCommentThreads.map((thread) => ({
      id: thread.id,
      line: thread.line,
      comments: thread.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      })),
    }))
  )
);

const getRowKey = (row: PRReviewDiffRow) => `${props.filename}:${row.key}`;

const isActiveDraftTarget = (line: number | null) =>
  Boolean(line && activeDraftLineForFile.value === line);

const getReviewThreadsForLine = (line: number | null) =>
  line ? (threadsByLine.value.get(line) ?? []) : [];

const getCodeLineTokenCacheKey = (content: string, filename: string) =>
  `${filename.length}:${filename}${content}`;

const getCachedCodeLineTokens = (content: string, filename: string) => {
  const cacheKey = getCodeLineTokenCacheKey(content, filename);
  const cachedTokens = codeLineTokenCache.get(cacheKey);

  if (cachedTokens) {
    codeLineTokenCache.delete(cacheKey);
    codeLineTokenCache.set(cacheKey, cachedTokens);
    return cachedTokens;
  }

  const tokens = tokenizeCodeLine(content, filename);
  codeLineTokenCache.set(cacheKey, tokens);

  if (codeLineTokenCache.size > CODE_LINE_TOKEN_CACHE_LIMIT) {
    const oldestCacheKey = codeLineTokenCache.keys().next().value;

    if (oldestCacheKey !== undefined) {
      codeLineTokenCache.delete(oldestCacheKey);
    }
  }

  return tokens;
};

const getEstimatedRowHeight = (row: PRReviewDiffRow) => {
  if (row.type === 'hunk') {
    return HUNK_ROW_ESTIMATED_HEIGHT;
  }

  let estimate = DIFF_ROW_ESTIMATED_HEIGHT;
  const threads = getReviewThreadsForLine(row.newLineNumber);

  if (threads.length) {
    const commentCount = threads.reduce((total, thread) => total + thread.comments.length, 0);
    estimate += Math.max(1, commentCount) * REVIEW_COMMENT_ESTIMATED_HEIGHT;
  }

  if (isActiveDraftTarget(row.newLineNumber)) {
    estimate += INLINE_COMMENT_ESTIMATED_HEIGHT;
  }

  return estimate;
};

const rowMetrics = computed<VirtualRow[]>(() => {
  let top = 0;

  return props.rows.map((row, index) => {
    const key = getRowKey(row);
    const height = measuredRowHeights.value.get(key) ?? getEstimatedRowHeight(row);
    const virtualRow = {
      row,
      index,
      key,
      top,
      height,
    };

    top += height;

    return virtualRow;
  });
});

const totalRowsHeight = computed(() => {
  const metrics = rowMetrics.value;
  const lastMetric = metrics[metrics.length - 1];
  return lastMetric ? lastMetric.top + lastMetric.height : 0;
});

const effectiveRange = computed(() => {
  if (!shouldVirtualize.value) {
    if (typeof IntersectionObserver !== 'undefined' && !isRowsNearViewport.value) {
      return { start: 0, end: 0 };
    }

    return { start: 0, end: props.rows.length };
  }

  return {
    start: Math.min(visibleRange.value.start, props.rows.length),
    end: Math.min(visibleRange.value.end, props.rows.length),
  };
});

const visibleRows = computed(() => {
  const range = effectiveRange.value;
  return rowMetrics.value.slice(range.start, range.end);
});

const renderedVisibleRows = computed<RenderedVirtualRow[]>(() =>
  visibleRows.value.map((virtualRow) => {
    const row = virtualRow.row;
    const hasActiveDraftTarget = isActiveDraftTarget(row.newLineNumber);

    if (row.type === 'hunk') {
      return {
        ...virtualRow,
        oldTokens: [],
        newTokens: [],
        reviewThreads: [],
        hasActiveDraftTarget,
      };
    }

    return {
      ...virtualRow,
      oldTokens: getCachedCodeLineTokens(getSideContent(row, 'old'), props.filename),
      newTokens: getCachedCodeLineTokens(getSideContent(row, 'new'), props.filename),
      reviewThreads: getReviewThreadsForLine(row.newLineNumber),
      hasActiveDraftTarget,
    };
  })
);

const topSpacerHeight = computed(() => {
  if (!shouldWindowRows.value) {
    return 0;
  }

  return visibleRows.value[0]?.top ?? 0;
});

const bottomSpacerHeight = computed(() => {
  if (!shouldWindowRows.value) {
    return 0;
  }

  const rows = visibleRows.value;
  const lastRow = rows[rows.length - 1];

  if (!lastRow) {
    return totalRowsHeight.value;
  }

  return Math.max(0, totalRowsHeight.value - lastRow.top - lastRow.height);
});

const setVisibleRange = (start: number, end: number) => {
  if (visibleRange.value.start === start && visibleRange.value.end === end) {
    return;
  }

  visibleRange.value = { start, end };
};

const findFirstRowEndingAfter = (metrics: VirtualRow[], offset: number) => {
  let low = 0;
  let high = metrics.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const rowBottom = metrics[mid].top + metrics[mid].height;

    if (rowBottom < offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

const findFirstRowStartingAfter = (metrics: VirtualRow[], offset: number) => {
  let low = 0;
  let high = metrics.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (metrics[mid].top <= offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

const syncVisibleRows = async () => {
  await nextTick();

  if (!shouldVirtualize.value) {
    setVisibleRange(0, props.rows.length);
    return;
  }

  const root = rowsRoot.value;
  const container = props.scrollContainer;

  if (!root || !container) {
    setVisibleRange(0, 0);
    return;
  }

  const metrics = rowMetrics.value;
  const totalHeight = totalRowsHeight.value;
  const rootRect = root.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const viewportTop = containerRect.top - rootRect.top - OVERSCAN_PX;
  const viewportBottom = containerRect.bottom - rootRect.top + OVERSCAN_PX;

  if (viewportBottom <= 0 || viewportTop >= totalHeight) {
    setVisibleRange(0, 0);
    return;
  }

  let start = findFirstRowEndingAfter(metrics, viewportTop);
  let end = findFirstRowStartingAfter(metrics, viewportBottom);

  start = Math.max(0, start - OVERSCAN_ROWS);
  end = Math.min(metrics.length, Math.max(end + OVERSCAN_ROWS, start + MIN_VISIBLE_ROWS));

  setVisibleRange(start, end);
};

const scheduleVisibleRowsSync = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof IntersectionObserver !== 'undefined' && !isRowsNearViewport.value) {
    setVisibleRange(0, 0);
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

const handleContainerScroll = () => {
  if (typeof IntersectionObserver !== 'undefined' && !isRowsNearViewport.value) {
    return;
  }

  scheduleVisibleRowsSync();
};

const flushMeasuredHeights = () => {
  measurementFrame = undefined;

  if (!pendingMeasuredHeights.size) {
    return;
  }

  let changed = false;
  const nextHeights = new Map(measuredRowHeights.value);

  for (const [rowKey, measuredHeight] of pendingMeasuredHeights) {
    const currentHeight = nextHeights.get(rowKey);

    if (measuredHeight > 0 && currentHeight !== measuredHeight) {
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
    const rowKey = (entry.target as HTMLElement).dataset.rowKey;

    if (!rowKey) {
      continue;
    }

    queueMeasuredRowHeight(rowKey, entry.contentRect.height);
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

const resetMeasurements = () => {
  pendingMeasuredHeights.clear();
  codeLineTokenCache.clear();
  measuredRowHeights.value = new Map();
  setVisibleRange(0, 0);
  scheduleVisibleRowsSync();
};

const clearMeasurements = () => {
  pendingMeasuredHeights.clear();
  measuredRowHeights.value = new Map();
  scheduleVisibleRowsSync();
};

const getRowSideClass = (row: PRReviewDiffRow, side: 'old' | 'new') => [
  'pr-review-diff-viewer__pane',
  `pr-review-diff-viewer__pane--${side}`,
  `pr-review-diff-viewer__pane--${
    row.type === 'replace' ? (side === 'old' ? 'delete' : 'add') : row.type
  }`,
  {
    'pr-review-diff-viewer__pane--replace': row.type === 'replace',
  },
  {
    'pr-review-diff-viewer__pane--empty':
      (side === 'old' && row.type === 'add') || (side === 'new' && row.type === 'delete'),
    'pr-review-diff-viewer__pane--commentable': side === 'new' && row.isCommentable,
  },
];

function getSideContent(row: PRReviewDiffRow, side: 'old' | 'new') {
  if (row.type === 'replace') {
    return (side === 'old' ? row.oldContent : row.newContent) || ' ';
  }
  if (side === 'old' && row.type === 'add') return '';
  if (side === 'new' && row.type === 'delete') return '';
  return row.content || ' ';
}

const handleSaveDraft = (line: number, body: string) => {
  const row = props.rows.find((diffRow) => diffRow.newLineNumber === line);

  if (!row?.position) {
    return;
  }

  emit('save-draft-comment', props.filename, line, row.position, body);
};

watch(() => [props.filename, props.rows], resetMeasurements, { flush: 'post' });

watch(activeDraftLineForFile, clearMeasurements, { flush: 'post' });

watch(reviewThreadsMeasurementKey, clearMeasurements, { flush: 'post' });

watch(
  () => props.scrollContainer,
  (container) => {
    scrollListenerTarget?.removeEventListener('scroll', handleContainerScroll);
    scrollListenerTarget = null;
    rowsIntersectionObserver?.disconnect();
    rowsIntersectionObserver = undefined;
    viewportResizeObserver?.disconnect();
    viewportResizeObserver = undefined;

    if (container) {
      scrollListenerTarget = container;
      container.addEventListener('scroll', handleContainerScroll, { passive: true });
    }

    if (container && typeof ResizeObserver !== 'undefined') {
      viewportResizeObserver = new ResizeObserver(scheduleVisibleRowsSync);
      viewportResizeObserver.observe(container);
    }

    if (!container || typeof IntersectionObserver === 'undefined') {
      isRowsNearViewport.value = true;
      scheduleVisibleRowsSync();
      return;
    }

    isRowsNearViewport.value = false;
    void nextTick(() => {
      const root = rowsRoot.value;

      if (!root || props.scrollContainer !== container) {
        isRowsNearViewport.value = true;
        scheduleVisibleRowsSync();
        return;
      }

      rowsIntersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isRowsNearViewport.value = entry.isIntersecting;

          if (entry.isIntersecting) {
            scheduleVisibleRowsSync();
          } else {
            setVisibleRange(0, 0);
          }
        },
        {
          root: container,
          rootMargin: `${OVERSCAN_PX}px 0px`,
        }
      );
      rowsIntersectionObserver.observe(root);
    });
  },
  { immediate: true, flush: 'post' }
);

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    rowResizeObserver = new ResizeObserver(applyMeasuredHeights);
    rowElements.forEach((element) => rowResizeObserver?.observe(element));
  }
});

onBeforeUnmount(() => {
  if (updateFrame) {
    window.cancelAnimationFrame(updateFrame);
  }

  if (measurementFrame) {
    window.cancelAnimationFrame(measurementFrame);
  }

  scrollListenerTarget?.removeEventListener('scroll', handleContainerScroll);
  rowResizeObserver?.disconnect();
  viewportResizeObserver?.disconnect();
  rowsIntersectionObserver?.disconnect();
});
</script>

<template>
  <div ref="rowsRoot" class="pr-review-diff-viewer__rows">
    <div
      v-if="topSpacerHeight"
      class="pr-review-diff-viewer__row-spacer"
      :style="{ height: `${topSpacerHeight}px` }"
      aria-hidden="true"
    ></div>

    <div
      v-for="virtualRow in renderedVisibleRows"
      :key="virtualRow.key"
      :ref="(element) => setRowElement(virtualRow.key, element)"
      class="pr-review-diff-viewer__virtual-row"
      :data-row-key="virtualRow.key"
    >
      <div v-if="virtualRow.row.type === 'hunk'" class="pr-review-diff-viewer__hunk">
        <code>{{ virtualRow.row.content }}</code>
      </div>

      <div v-else class="pr-review-diff-viewer__split-row">
        <div :class="getRowSideClass(virtualRow.row, 'old')">
          <span class="pr-review-diff-viewer__line-number">{{
            virtualRow.row.oldLineNumber ?? ''
          }}</span>
          <code class="pr-review-diff-viewer__code">
            <span
              v-for="token in virtualRow.oldTokens"
              :key="token.key"
              class="pr-review-diff-viewer__token"
              :class="`pr-review-diff-viewer__token--${token.kind}`"
              >{{ token.text }}</span
            >
          </code>
        </div>

        <span class="pr-review-diff-viewer__split-divider" aria-hidden="true"></span>

        <div :class="getRowSideClass(virtualRow.row, 'new')">
          <span class="pr-review-diff-viewer__line-number">
            <span class="pr-review-diff-viewer__line-num">{{
              virtualRow.row.newLineNumber ?? ''
            }}</span>
            <button
              class="pr-review-diff-viewer__comment-button"
              type="button"
              :aria-label="
                virtualRow.row.newLineNumber
                  ? t('prReview.addLineCommentForLine', {
                      line: virtualRow.row.newLineNumber,
                    })
                  : t('prReview.addLineComment')
              "
              :disabled="
                !virtualRow.row.isCommentable || !virtualRow.row.newLineNumber || submitting
              "
              :title="
                virtualRow.row.isCommentable
                  ? t('prReview.addLineComment')
                  : t('prReview.lineNotCommentable')
              "
              @click="
                virtualRow.row.newLineNumber
                  ? emit('open-draft-editor', filename, virtualRow.row.newLineNumber)
                  : undefined
              "
            >
              +
            </button>
          </span>
          <div class="pr-review-diff-viewer__new-line">
            <code class="pr-review-diff-viewer__code">
              <span
                v-for="token in virtualRow.newTokens"
                :key="token.key"
                class="pr-review-diff-viewer__token"
                :class="`pr-review-diff-viewer__token--${token.kind}`"
                >{{ token.text }}</span
              >
            </code>
            <div
              v-if="virtualRow.reviewThreads.length"
              class="pr-review-diff-viewer__new-line-threads"
            >
              <div
                v-for="thread in virtualRow.reviewThreads"
                :key="thread.id"
                class="pr-review-diff-viewer__review-thread"
              >
                <article
                  v-for="comment in thread.comments"
                  :key="comment.id"
                  class="pr-review-diff-viewer__review-comment"
                >
                  <div class="pr-review-diff-viewer__review-comment-header">
                    <RoundImg
                      width="24"
                      height="24"
                      :src="comment.author?.avatarUrl || ''"
                      :alt="comment.author?.login || ''"
                    />
                    <div class="pr-review-diff-viewer__review-comment-meta">
                      <a
                        v-if="comment.author?.url"
                        :href="comment.author.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="has-text-link has-text-weight-semibold"
                      >
                        {{ comment.author.login }}
                      </a>
                      <strong v-else>{{
                        comment.author?.login || t('prReview.unknownReviewAuthor')
                      }}</strong>
                      <a
                        v-if="comment.url"
                        :href="comment.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="has-text-grey"
                      >
                        {{ formatDurationFromNow(comment.createdAt || '', localeCode) }}
                      </a>
                      <span v-else-if="comment.createdAt" class="has-text-grey">
                        {{ formatDurationFromNow(comment.createdAt, localeCode) }}
                      </span>
                    </div>
                  </div>
                  <div class="pr-review-diff-viewer__review-comment-body content">
                    <MarkdownRenderer
                      v-if="comment.body"
                      :value="comment.body"
                      :repo-owner="repoOwner"
                      :repo-name="repoName"
                    />
                    <p v-else class="has-text-grey mb-0">
                      {{ t('prReview.noReviewCommentBody') }}
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PRReviewInlineComment
        v-if="virtualRow.row.newLineNumber && virtualRow.hasActiveDraftTarget"
        :path="filename"
        :line="virtualRow.row.newLineNumber"
        :body="activeDraftBody"
        :submitting="submitting"
        @update:body="emit('update-active-draft-body', $event)"
        @save="(_path, line, body) => handleSaveDraft(line, body)"
        @cancel="emit('close-draft-editor')"
      />
    </div>

    <div
      v-if="bottomSpacerHeight"
      class="pr-review-diff-viewer__row-spacer"
      :style="{ height: `${bottomSpacerHeight}px` }"
      aria-hidden="true"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.pr-review-diff-viewer__rows {
  min-width: 100%;
}

.pr-review-diff-viewer__row-spacer {
  min-width: 100%;
}

.pr-review-diff-viewer__virtual-row {
  min-width: 100%;
}

.pr-review-diff-viewer__split-row {
  min-width: 100%;
  min-height: 1.55rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 2px minmax(0, 1fr);
  border-bottom: 1px solid var(--gitpulse-border);
}

.pr-review-diff-viewer__hunk {
  min-width: 100%;
  padding: 0.22rem 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--gitpulse-info) 24%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--gitpulse-info) 24%, transparent);
  background: var(--gitpulse-diff-hunk-bg);
  color: var(--gitpulse-info);
  font-weight: 600;
}

.pr-review-diff-viewer__hunk code,
.pr-review-diff-viewer__code {
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Menlo,
    Consolas,
    Liberation Mono,
    monospace;
  font-size: 12px;
}

.pr-review-diff-viewer__split-divider {
  background: var(--gitpulse-border);
}

.pr-review-diff-viewer__pane {
  min-width: 0;
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr);
}

.pr-review-diff-viewer__pane--new {
  border-right: 0;
}

.pr-review-diff-viewer__pane--add {
  background: var(--gitpulse-diff-add-bg);
}

.pr-review-diff-viewer__pane--delete {
  background: var(--gitpulse-diff-delete-bg);
}

.pr-review-diff-viewer__pane--context {
  background: var(--gitpulse-surface);
}

.pr-review-diff-viewer__pane--empty {
  background: var(--gitpulse-diff-empty-bg);
  color: transparent;
}

.pr-review-diff-viewer__line-number {
  padding: 0.2rem 0.3rem;
  border-right: 1px solid var(--gitpulse-border);
  color: var(--gitpulse-text-muted);
  text-align: center;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.pr-review-diff-viewer__line-num {
  display: inline-block;
  min-width: 2.2rem;
  text-align: center;
}

.pr-review-diff-viewer__comment-button {
  width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: transparent;
  cursor: pointer;
  font-size: 0;
  line-height: 1;
  transition: none;
  overflow: hidden;
}

.pr-review-diff-viewer__pane--commentable:hover
  .pr-review-diff-viewer__comment-button:not(:disabled),
.pr-review-diff-viewer__pane--commentable:focus-within
  .pr-review-diff-viewer__comment-button:not(:disabled) {
  width: 1rem;
  font-size: 11px;
  color: var(--gitpulse-info);
  font-weight: 700;
}

.pr-review-diff-viewer__comment-button:disabled {
  cursor: default;
}

.pr-review-diff-viewer__code {
  min-width: 0;
  padding: 0.2rem 0.65rem;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
}

.pr-review-diff-viewer__pane--empty .pr-review-diff-viewer__code {
  color: transparent;
}

.pr-review-diff-viewer__new-line {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.pr-review-diff-viewer__new-line > .pr-review-diff-viewer__code {
  display: block;
}

.pr-review-diff-viewer__new-line-threads {
  margin-top: 0.35rem;
  padding-left: 0.9rem;
  border-left: 2px solid color-mix(in srgb, var(--gitpulse-border-strong) 75%, transparent);
}

.pr-review-diff-viewer__review-thread {
  margin: 0 0 0.5rem;
}

.pr-review-diff-viewer__review-comment {
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
}

.pr-review-diff-viewer__review-comment + .pr-review-diff-viewer__review-comment {
  margin-top: 0.5rem;
}

.pr-review-diff-viewer__review-comment-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.pr-review-diff-viewer__review-comment-meta {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  align-items: center;
}

.pr-review-diff-viewer__review-comment-body {
  margin-top: 0.55rem;
  margin-bottom: 0;
}

.pr-review-diff-viewer__review-comment-body :deep(.markdown-body) {
  font-size: 12px;
}

.pr-review-diff-viewer__review-comment-body :deep(.markdown-body code) {
  font-size: 12px;
}

.pr-review-diff-viewer__token--keyword {
  color: var(--gitpulse-danger);
}

.pr-review-diff-viewer__token--string {
  color: var(--gitpulse-success);
}

.pr-review-diff-viewer__token--number {
  color: var(--gitpulse-info);
}

.pr-review-diff-viewer__token--comment {
  color: var(--gitpulse-text-muted);
}

.pr-review-diff-viewer__token--operator {
  color: var(--gitpulse-text-muted);
}

.pr-review-diff-viewer__token--function {
  color: var(--gitpulse-purple);
}

.pr-review-diff-viewer__token--property {
  color: var(--gitpulse-warning);
}
</style>
