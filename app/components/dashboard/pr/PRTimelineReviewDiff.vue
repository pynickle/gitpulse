<script setup lang="ts">
import { computed } from 'vue';

import { parsePRReviewPatch, type PRReviewDiffRow } from '~/composables/usePRReview';
import tokenizeCodeLine from '~/utils/tokenizeCodeLine';

type TimelineDiffKind = 'hunk' | 'context' | 'add' | 'delete';

interface TimelineDiffLine {
  key: string;
  kind: TimelineDiffKind;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  marker: string;
  content: string;
}

const props = defineProps<{
  filename: string;
  patch?: string;
  lines?: TimelineDiffLine[];
  ariaLabel?: string;
}>();

const rowToLines = (row: PRReviewDiffRow): TimelineDiffLine[] => {
  if (row.type === 'hunk') {
    return [
      {
        key: row.key,
        kind: 'hunk',
        oldLineNumber: null,
        newLineNumber: null,
        marker: '',
        content: row.content,
      },
    ];
  }

  if (row.type === 'replace') {
    return [
      {
        key: `${row.key}:delete`,
        kind: 'delete',
        oldLineNumber: row.oldLineNumber,
        newLineNumber: null,
        marker: '-',
        content: row.oldContent ?? row.content,
      },
      {
        key: `${row.key}:add`,
        kind: 'add',
        oldLineNumber: null,
        newLineNumber: row.newLineNumber,
        marker: '+',
        content: row.newContent ?? row.content,
      },
    ];
  }

  if (row.type === 'delete') {
    return [
      {
        key: row.key,
        kind: 'delete',
        oldLineNumber: row.oldLineNumber,
        newLineNumber: null,
        marker: '-',
        content: row.content,
      },
    ];
  }

  if (row.type === 'add') {
    return [
      {
        key: row.key,
        kind: 'add',
        oldLineNumber: null,
        newLineNumber: row.newLineNumber,
        marker: '+',
        content: row.content,
      },
    ];
  }

  return [
    {
      key: row.key,
      kind: 'context',
      oldLineNumber: row.oldLineNumber,
      newLineNumber: row.newLineNumber,
      marker: ' ',
      content: row.content,
    },
  ];
};

const diffLines = computed(() => {
  if (props.lines) return props.lines;
  return parsePRReviewPatch(props.patch).flatMap(rowToLines);
});
</script>

<template>
  <div class="timeline-review-diff" role="region" :aria-label="ariaLabel">
    <div
      v-for="line in diffLines"
      :key="line.key"
      class="timeline-review-diff__line"
      :class="`timeline-review-diff__line--${line.kind}`"
    >
      <template v-if="line.kind === 'hunk'">
        <span class="timeline-review-diff__hunk-text">{{ line.content }}</span>
      </template>
      <template v-else>
        <span class="timeline-review-diff__line-number">{{ line.oldLineNumber ?? '' }}</span>
        <span class="timeline-review-diff__line-number">{{ line.newLineNumber ?? '' }}</span>
        <span class="timeline-review-diff__marker">{{ line.marker }}</span>
        <code class="timeline-review-diff__code">
          <span
            v-for="token in tokenizeCodeLine(line.content || ' ', filename)"
            :key="token.key"
            class="timeline-review-diff__token"
            :class="`timeline-review-diff__token--${token.kind}`"
            >{{ token.text }}</span
          >
        </code>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.timeline-review-diff {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  font-family: var(--gitpulse-code-font-family);
  font-size: 12px;
  line-height: 1.45;
}

.timeline-review-diff__line {
  min-width: 0;
  display: grid;
  grid-template-columns: 3.25rem 3.25rem 1.25rem minmax(0, 1fr);
  border-bottom: 1px solid color-mix(in srgb, var(--gitpulse-border) 68%, transparent);
}

.timeline-review-diff__line:last-child {
  border-bottom: 0;
}

.timeline-review-diff__line--add {
  background: var(--gitpulse-diff-add-bg);
}

.timeline-review-diff__line--delete {
  background: var(--gitpulse-diff-delete-bg);
}

.timeline-review-diff__line--context {
  background: var(--gitpulse-surface);
}

.timeline-review-diff__line--hunk {
  display: block;
  padding: 0.22rem 0.75rem;
  background: var(--gitpulse-diff-hunk-bg);
  color: var(--gitpulse-info);
  font-weight: 600;
}

.timeline-review-diff__line-number {
  padding: 0.18rem 0.35rem;
  border-right: 1px solid var(--gitpulse-border);
  color: var(--gitpulse-text-muted);
  text-align: right;
  user-select: none;
}

.timeline-review-diff__marker {
  padding: 0.18rem 0;
  color: var(--gitpulse-text-muted);
  text-align: center;
  user-select: none;
}

.timeline-review-diff__code {
  min-width: 0;
  padding: 0.18rem 0.65rem 0.18rem 0;
  background: transparent;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 12px;
}

.timeline-review-diff__token--keyword {
  color: var(--gitpulse-danger);
}

.timeline-review-diff__token--string {
  color: var(--gitpulse-success);
}

.timeline-review-diff__token--number {
  color: var(--gitpulse-info);
}

.timeline-review-diff__token--comment {
  color: var(--gitpulse-text-muted);
}

.timeline-review-diff__token--operator {
  color: var(--gitpulse-text-muted);
}

.timeline-review-diff__token--function {
  color: var(--gitpulse-purple);
}

.timeline-review-diff__token--property {
  color: var(--gitpulse-warning);
}
</style>
