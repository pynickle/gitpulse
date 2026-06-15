<template>
  <TimelineCommentCard
    v-if="isPlainComment"
    :item="item"
    :empty-text="t('detailTimeline.noCommentBody')"
    :repo-owner="repoOwner"
    :repo-name="repoName"
    :enable-reactions="false"
  />
  <div
    v-else
    class="review-item p-4"
    :class="[`review-item--${stateModifier}`, { 'review-item--has-dismissal': item.dismissal }]"
  >
    <div class="is-flex is-align-items-flex-start">
      <GitHubAvatar
        variant="raised"
        interactive
        class="mr-3 review-item__avatar"
        width="32"
        height="32"
        :src="item.author?.avatarUrl || ''"
        :alt="item.author?.login || ''"
      />
      <div class="review-item__content is-flex-grow-1">
        <div class="review-item__heading">
          <span class="review-item__badge" aria-hidden="true">
            <component :is="stateIcon" :size="14" :stroke-width="2.5" />
          </span>
          <a
            :href="item.author?.url"
            target="_blank"
            rel="noopener"
            class="has-text-link has-text-weight-semibold review-item__author"
          >
            {{ item.author?.login }}
          </a>
          <span class="review-item__action">{{ stateAction }}</span>
          <span v-if="item.dismissal" class="review-item__dismissed-note">
            {{ t('prReview.timelineDismissedNote') }}
          </span>
          <span class="review-item__time has-text-grey">
            {{ formatDurationFromNow(item.createdAt || '', localeCode, relativeTimeNow) }}
          </span>
        </div>
        <div v-if="item.body" class="review-item__body content">
          <MarkdownRenderer :value="item.body" :repo-owner="repoOwner" :repo-name="repoName" />
        </div>
        <div v-if="item.dismissal" class="review-item__dismissal">
          <div class="review-item__dismissal-heading">
            <SlashIcon :size="14" :stroke-width="2.5" />
            <span>
              {{ t('prReview.timelineDismissed') }}
              <template v-if="item.dismissal.actor?.login">
                {{ t('prReview.timelineDismissedBy') }}
                <a
                  :href="item.dismissal.actor.url"
                  target="_blank"
                  rel="noopener"
                  class="has-text-link"
                >
                  {{ item.dismissal.actor.login }}
                </a>
              </template>
            </span>
            <span v-if="item.dismissal.createdAt" class="has-text-grey">
              {{ formatDurationFromNow(item.dismissal.createdAt, localeCode, relativeTimeNow) }}
            </span>
          </div>
          <MarkdownRenderer
            v-if="item.dismissal.message"
            class="review-item__dismissal-message"
            :value="item.dismissal.message"
            :repo-owner="repoOwner"
            :repo-name="repoName"
          />
        </div>
        <div v-if="hasReviewComments" class="review-item__comments">
          <article
            v-for="group in reviewCommentGroups"
            :key="group.path"
            class="review-item__file-group"
            :class="{ 'review-item__file-group--expanded': isFileExpanded(group.path) }"
          >
            <button
              class="review-item__file-toggle"
              type="button"
              :aria-expanded="isFileExpanded(group.path)"
              @click="toggleFile(group.path)"
            >
              <ChevronRightIcon
                :size="14"
                class="review-item__file-chevron"
                :class="{ 'review-item__file-chevron--expanded': isFileExpanded(group.path) }"
                aria-hidden="true"
              />
              <span class="review-item__file-name">{{ group.path }}</span>
              <span class="review-item__file-count">
                {{ group.comments.length }}
              </span>
            </button>

            <div v-if="isFileExpanded(group.path)" class="review-item__file-comments">
              <div
                v-for="comment in group.comments"
                :key="comment.id || `${comment.path}-${comment.createdAt}`"
                class="review-item__comment"
              >
                <PRTimelineReviewDiff
                  v-if="comment.diffHunk"
                  class="review-item__diff"
                  :filename="comment.path ?? group.path"
                  :lines="buildReviewCommentDiffLines(comment)"
                  :aria-label="t('prReview.reviewDiffLabel', { filename: group.path })"
                />
                <div class="review-item__comment-meta">
                  <div class="review-item__comment-meta-left">
                    <GitHubAvatar
                      variant="raised"
                      interactive
                      width="20"
                      height="20"
                      :src="comment.author?.avatarUrl || ''"
                      :alt="comment.author?.login || ''"
                    />
                    <a
                      :href="comment.author?.url"
                      target="_blank"
                      rel="noopener"
                      class="has-text-link"
                    >
                      {{ comment.author?.login }}
                    </a>
                    <a
                      v-if="comment.url"
                      :href="comment.url"
                      target="_blank"
                      rel="noopener"
                      class="review-item__path-tag"
                    >
                      {{ commentLineLabel(comment) }}
                    </a>
                    <span v-if="comment.createdAt" class="has-text-grey">
                      {{ formatDurationFromNow(comment.createdAt, localeCode, relativeTimeNow) }}
                    </span>
                    <span
                      v-if="comment.isOutdated"
                      class="tag is-warning is-light review-item__outdated-tag"
                    >
                      {{ t('prReview.threadOutdated') }}
                    </span>
                  </div>
                  <div v-if="comment.threadId" class="review-item__thread-status">
                    <button
                      class="review-item__thread-toggle"
                      type="button"
                      :class="{
                        'is-resolved': comment.isResolved,
                        'is-loading': isReviewThreadResolving(comment),
                      }"
                      :disabled="isReviewThreadResolving(comment)"
                      :aria-label="reviewThreadActionLabel(comment)"
                      :title="reviewThreadActionLabel(comment)"
                      @click="toggleReviewThread(comment)"
                    >
                      <component
                        :is="comment.isResolved ? CheckIcon : CircleIcon"
                        :size="14"
                        :stroke-width="2.5"
                        aria-hidden="true"
                      />
                    </button>
                    <span class="review-item__thread-label">
                      {{ reviewThreadStateLabel(comment) }}
                    </span>
                  </div>
                </div>
                <div class="review-item__comment-body content">
                  <template v-if="comment.body">
                    <template v-for="part in splitSuggestionBody(comment.body)" :key="part.key">
                      <MarkdownRenderer
                        v-if="part.kind === 'markdown' && part.value.trim()"
                        :value="part.value"
                        :repo-owner="repoOwner"
                        :repo-name="repoName"
                      />
                      <PRTimelineReviewDiff
                        v-else-if="part.kind === 'suggestion'"
                        class="review-item__suggestion"
                        :filename="comment.path ?? group.path"
                        :lines="buildSuggestionDiffLines(comment, part.value)"
                        :aria-label="t('prReview.suggestedChangeLabel', { filename: group.path })"
                      />
                    </template>
                  </template>
                  <p v-else class="has-text-grey is-size-7">
                    {{ t('prReview.noReviewCommentBody') }}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CheckIcon,
  ChevronRightIcon,
  CircleIcon,
  ClockIcon,
  MessageSquareIcon,
  SlashIcon,
  XIcon,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import PRTimelineReviewDiff from '~/components/dashboard/pr/PRTimelineReviewDiff.vue';
import TimelineCommentCard from '~/components/dashboard/timeline/TimelineCommentCard.vue';
import GitHubAvatar from '~/components/ui/GitHubAvatar.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import { parsePRReviewPatch } from '~/composables/usePRReview';
import type { PRTimelineItem, TimelineReviewComment } from '~/composables/usePRTimelineEvents';
import formatDurationFromNow from '~/utils/formatDurationFromNow';

const props = defineProps<{
  item: PRTimelineItem;
  repoOwner: string;
  repoName: string;
  resolvingReviewThreadId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'toggle-review-thread', payload: { threadId: string; resolved: boolean }): void;
}>();

const { t, locale } = useI18n();
const localeCode = computed(() => locale.value);
const relativeTimeNow = useRelativeTimeNow();
const hasReviewComments = computed(() => Boolean(props.item.reviewComments?.length));
const expandedFiles = ref(new Set<string>());

interface ReviewCommentGroup {
  path: string;
  comments: TimelineReviewComment[];
}

interface CommentBodyPart {
  key: string;
  kind: 'markdown' | 'suggestion';
  value: string;
}

interface SuggestionDiffLine {
  key: string;
  kind: 'hunk' | 'context' | 'add' | 'delete';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  marker: string;
  content: string;
}

const reviewCommentGroups = computed<ReviewCommentGroup[]>(() => {
  const groups = new Map<string, TimelineReviewComment[]>();

  for (const comment of props.item.reviewComments ?? []) {
    const path = comment.path ?? 'file';
    const comments = groups.get(path) ?? [];
    comments.push(comment);
    groups.set(path, comments);
  }

  return [...groups.entries()].map(([path, comments]) => ({ path, comments }));
});

const isPlainComment = computed(() => {
  const state = props.item.state;
  return !state || (state === 'commented' && !hasReviewComments.value && !props.item.dismissal);
});

const stateModifier = computed(() => {
  switch (props.item.state) {
    case 'approved':
      return 'approved';
    case 'changes_requested':
      return 'changes-requested';
    case 'commented':
      return 'commented';
    case 'dismissed':
      return 'dismissed';
    case 'pending':
      return 'pending';
    default:
      return 'pending';
  }
});

const stateAction = computed(() => {
  switch (props.item.state) {
    case 'approved':
      return t('prReview.timelineApprovedChanges');
    case 'changes_requested':
      return t('prReview.timelineRequestedChanges');
    case 'commented':
      return t('prReview.timelineCommented');
    case 'dismissed':
      return t('prReview.timelineDismissedReview');
    case 'pending':
      return t('prReview.timelineStartedReview');
    default:
      return t('prReview.timelineReviewed');
  }
});

const stateIcon = computed(() => {
  switch (stateModifier.value) {
    case 'approved':
      return CheckIcon;
    case 'changes-requested':
      return XIcon;
    case 'dismissed':
      return SlashIcon;
    case 'commented':
      return MessageSquareIcon;
    case 'pending':
    default:
      return ClockIcon;
  }
});

const commentLineLabel = (comment: TimelineReviewComment) => {
  // Range display: if originalStartLine exists, show range
  if (comment.originalStartLine != null && comment.originalLine != null) {
    return t('prReview.lineRangeLabel', {
      start: comment.originalStartLine,
      end: comment.originalLine,
    });
  }

  // Single line display: prefer originalLine
  const line = comment.originalLine ?? comment.line ?? comment.position ?? comment.originalPosition;
  return line ? t('prReview.lineLabel', { line }) : t('prReview.fileLabel');
};

const isFileExpanded = (path: string) => expandedFiles.value.has(path);

const toggleFile = (path: string) => {
  const updated = new Set(expandedFiles.value);
  if (updated.has(path)) {
    updated.delete(path);
  } else {
    updated.add(path);
  }
  expandedFiles.value = updated;
};

const isReviewThreadResolving = (comment: TimelineReviewComment) =>
  Boolean(comment.threadId && props.resolvingReviewThreadId === comment.threadId);

const reviewThreadActionLabel = (comment: TimelineReviewComment) =>
  comment.isResolved ? t('prReview.unresolveThread') : t('prReview.resolveThread');

const reviewThreadStateLabel = (comment: TimelineReviewComment) =>
  comment.isResolved ? t('prReview.threadResolved') : t('prReview.threadUnresolved');

const toggleReviewThread = (comment: TimelineReviewComment) => {
  if (!comment.threadId || isReviewThreadResolving(comment)) {
    return;
  }

  emit('toggle-review-thread', {
    threadId: comment.threadId,
    resolved: !Boolean(comment.isResolved),
  });
};

const splitSuggestionBody = (body: string): CommentBodyPart[] => {
  const parts: CommentBodyPart[] = [];
  const suggestionPattern = /```suggestion[^\n\r]*\r?\n([\s\S]*?)(?:\r?\n)?```/g;
  let cursor = 0;
  let partIndex = 0;

  for (const match of body.matchAll(suggestionPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({
        key: `markdown-${partIndex}`,
        kind: 'markdown',
        value: body.slice(cursor, index),
      });
      partIndex += 1;
    }

    parts.push({
      key: `suggestion-${partIndex}`,
      kind: 'suggestion',
      value: match[1] ?? '',
    });
    partIndex += 1;
    cursor = index + match[0].length;
  }

  if (cursor < body.length) {
    parts.push({
      key: `markdown-${partIndex}`,
      kind: 'markdown',
      value: body.slice(cursor),
    });
  }

  return parts.length ? parts : [{ key: 'markdown-0', kind: 'markdown', value: body }];
};

const getCommentDiffSide = (comment: TimelineReviewComment): 'LEFT' | 'RIGHT' =>
  comment.startSide === 'LEFT' || comment.side === 'LEFT' ? 'LEFT' : 'RIGHT';

const getCommentDiffRange = (comment: TimelineReviewComment) => {
  const side = getCommentDiffSide(comment);
  const start =
    side === 'LEFT'
      ? (comment.originalStartLine ?? comment.originalLine ?? comment.startLine ?? comment.line)
      : (comment.originalStartLine ?? comment.originalLine ?? comment.startLine ?? comment.line);
  const end =
    side === 'LEFT'
      ? (comment.originalLine ?? comment.line ?? comment.originalStartLine ?? comment.startLine)
      : (comment.originalLine ?? comment.line ?? comment.originalStartLine ?? comment.startLine);

  if (!start || !end) {
    return null;
  }

  return {
    side,
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
};

const getRowLineForSide = (
  row: ReturnType<typeof parsePRReviewPatch>[number],
  side: 'LEFT' | 'RIGHT'
) => (side === 'LEFT' ? row.oldLineNumber : row.newLineNumber);

const isRowInCommentRange = (
  row: ReturnType<typeof parsePRReviewPatch>[number],
  range: NonNullable<ReturnType<typeof getCommentDiffRange>>
) => {
  if (row.type === 'hunk') {
    return false;
  }

  const line = getRowLineForSide(row, range.side);
  return Boolean(line && line >= range.start && line <= range.end);
};

const getVisibleHunkContent = (
  rows: ReturnType<typeof parsePRReviewPatch>,
  fallbackContent?: string
) => {
  const fallbackMatch = fallbackContent?.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  const fallbackOldStart = Number.parseInt(fallbackMatch?.[1] ?? '0', 10);
  const fallbackNewStart = Number.parseInt(fallbackMatch?.[2] ?? '0', 10);
  const visibleRows = rows.filter((row) => row.type !== 'hunk');
  const oldLineNumbers = visibleRows
    .map((row) => row.oldLineNumber)
    .filter((line): line is number => line != null);
  const newLineNumbers = visibleRows
    .map((row) => row.newLineNumber)
    .filter((line): line is number => line != null);

  const oldStart = oldLineNumbers[0] ?? fallbackOldStart;
  const newStart = newLineNumbers[0] ?? fallbackNewStart;

  if (!oldStart && !newStart) {
    return fallbackContent ?? '';
  }

  return `@@ -${oldStart},${oldLineNumbers.length} +${newStart},${newLineNumbers.length} @@`;
};

const rowToTimelineLines = (
  row: ReturnType<typeof parsePRReviewPatch>[number]
): SuggestionDiffLine[] => {
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

const buildReviewCommentDiffLines = (comment: TimelineReviewComment): SuggestionDiffLine[] => {
  const rows = parsePRReviewPatch(comment.diffHunk);
  const range = getCommentDiffRange(comment);
  const hunk = rows.find((row) => row.type === 'hunk');

  if (!range) {
    return rows.flatMap(rowToTimelineLines);
  }

  const isSingleLineComment = comment.startLine == null && comment.originalStartLine == null;
  const effectiveRange = isSingleLineComment
    ? { ...range, start: Math.max(1, range.end - 3) }
    : range;

  const selectedRows = rows.filter((row) => isRowInCommentRange(row, effectiveRange));
  const selectedLines = selectedRows.flatMap(rowToTimelineLines);

  if (!selectedLines.length) {
    return rows.flatMap(rowToTimelineLines);
  }

  return [
    ...(hunk
      ? [
          {
            key: hunk.key,
            kind: 'hunk' as const,
            oldLineNumber: null,
            newLineNumber: null,
            marker: '',
            content: getVisibleHunkContent(selectedRows, hunk.content),
          },
        ]
      : []),
    ...selectedLines,
  ];
};

const getSuggestionOriginalLines = (comment: TimelineReviewComment) => {
  const range = getCommentDiffRange(comment);
  if (!range) {
    return [];
  }

  return parsePRReviewPatch(comment.diffHunk)
    .filter((row) => isRowInCommentRange(row, range))
    .map((row) => {
      if (row.type === 'replace') {
        return {
          lineNumber: getRowLineForSide(row, range.side),
          content: range.side === 'LEFT' ? (row.oldContent ?? '') : (row.newContent ?? ''),
        };
      }

      return {
        lineNumber: getRowLineForSide(row, range.side),
        content: row.content,
      };
    })
    .filter((line): line is { lineNumber: number; content: string } => Boolean(line.lineNumber));
};

const getSuggestionStartLine = (comment: TimelineReviewComment) =>
  getCommentDiffRange(comment)?.start ?? comment.line ?? comment.originalLine ?? null;

const getSuggestionAddLineNumber = (
  comment: TimelineReviewComment,
  startLine: number | null,
  index: number
) => {
  if (!startLine) {
    return null;
  }

  return getCommentDiffSide(comment) === 'LEFT' ? null : startLine + index;
};

const getSuggestionDeleteLineNumbers = (comment: TimelineReviewComment, lineNumber: number) => {
  if (getCommentDiffSide(comment) === 'LEFT') {
    return {
      oldLineNumber: lineNumber,
      newLineNumber: null,
    };
  }

  return {
    oldLineNumber: null,
    newLineNumber: lineNumber,
  };
};

const buildSuggestionDiffLines = (
  comment: TimelineReviewComment,
  suggestion: string
): SuggestionDiffLine[] => {
  const startLine = getSuggestionStartLine(comment);
  const originalLines = getSuggestionOriginalLines(comment);
  const suggestionLines = suggestion.replace(/\r\n/g, '\n').split('\n');
  if (suggestionLines.at(-1) === '') {
    suggestionLines.pop();
  }

  return [
    ...originalLines.map((line, index) => ({
      key: `suggestion-delete-${index}`,
      kind: 'delete' as const,
      ...getSuggestionDeleteLineNumbers(comment, line.lineNumber),
      marker: '-',
      content: line.content,
    })),
    ...suggestionLines.map((line, index) => ({
      key: `suggestion-add-${index}`,
      kind: 'add' as const,
      oldLineNumber: null,
      newLineNumber: getSuggestionAddLineNumber(comment, startLine, index),
      marker: '+',
      content: line,
    })),
  ];
};
</script>

<style scoped lang="scss">
.review-item {
  border-radius: 16px;
  background-color: var(--gitpulse-surface-muted);
  border-left: 4px solid var(--review-accent, var(--gitpulse-border-strong));
  overflow: hidden;
}

.review-item--approved {
  --review-accent: var(--gitpulse-success);
  background-color: var(--gitpulse-success-soft);
}

.review-item--changes-requested {
  --review-accent: var(--gitpulse-danger);
  background: var(--gitpulse-surface-muted);
}

.review-item--commented {
  --review-accent: var(--gitpulse-info);
  background-color: var(--gitpulse-surface-muted);
}

.review-item--dismissed {
  --review-accent: var(--gitpulse-text-subtle);
  background-color: var(--gitpulse-surface-muted);
}

.review-item--has-dismissal {
  --review-accent: var(--gitpulse-warning);
  background-color: var(--gitpulse-warning-soft);
}

.review-item--pending {
  --review-accent: var(--gitpulse-warning);
  background-color: var(--gitpulse-warning-soft);
}

.review-item__avatar {
  flex-shrink: 0;
}

.review-item__content {
  min-width: 0;
}

.review-item__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 0.5rem;
  row-gap: 0.25rem;
  min-height: 32px;
}

.review-item__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  background: var(--review-accent, var(--gitpulse-border-strong));
}

.review-item__author {
  font-size: 0.95rem;
}

.review-item__action {
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.review-item__dismissed-note {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--gitpulse-warning) 18%, transparent);
  color: var(--gitpulse-warning);
  font-size: 0.72rem;
  font-weight: 700;
}

.review-item__time {
  font-size: 0.8rem;
}

.review-item__body {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--gitpulse-border);
}

.review-item__body :deep(*:last-child) {
  margin-bottom: 0;
}

.review-item__dismissal,
.review-item__comments {
  min-width: 0;
  margin-top: 1.25rem;
  padding: 1rem 0.25rem 0.25rem;
  border-top: 1px solid var(--gitpulse-border);
}

.review-item__dismissal-heading,
.review-item__comment-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--gitpulse-text-muted);
}

.review-item__comment-meta-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.review-item__dismissal-message {
  margin-top: 0.625rem;
}

.review-item__file-group {
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface) 72%, transparent);
  overflow: hidden;
  min-width: 0;
}

.review-item__file-group + .review-item__file-group {
  margin-top: 0.625rem;
}

.review-item--changes-requested .review-item__file-group {
  border-color: var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.review-item--changes-requested .review-item__file-toggle {
  background: var(--gitpulse-surface-muted);
}

.review-item__file-toggle {
  width: 100%;
  min-height: 2.35rem;
  padding: 0.45rem 0.6rem;
  border: 0;
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 84%, transparent);
  color: var(--gitpulse-text-strong);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  text-align: left;
}

.review-item__file-toggle:hover {
  background: var(--gitpulse-surface-hover);
}

.review-item__file-toggle:focus-visible {
  outline: 2px solid var(--gitpulse-focus-ring);
  outline-offset: -2px;
}

.review-item__file-chevron {
  flex: none;
  color: var(--gitpulse-text-muted);
  transition: transform 0.15s ease;
}

.review-item__file-chevron--expanded {
  transform: rotate(90deg);
}

.review-item__file-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.78rem;
  font-weight: 700;
}

.review-item__file-count {
  flex: none;
  font-size: 0.65rem;
  font-weight: 600;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--gitpulse-text-muted) 15%, transparent);
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.review-item__file-comments {
  border-top: 1px solid var(--gitpulse-border);
  padding: 1rem;
  min-width: 0;
}

.review-item__path-tag {
  font-size: 0.68rem;
  font-family: var(--gitpulse-code-font-family);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: color-mix(in srgb, var(--gitpulse-info) 10%, transparent);
  color: var(--gitpulse-text-muted);
  border: 1px solid color-mix(in srgb, var(--gitpulse-info) 20%, transparent);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.review-item__outdated-tag {
  font-size: 0.65rem;
  font-weight: 700;
}

.review-item__thread-status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.review-item__thread-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 1.5px solid var(--gitpulse-border-strong);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    border-color: var(--gitpulse-success);
    color: var(--gitpulse-success);
    background: var(--gitpulse-success-soft);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }

  &.is-resolved {
    border-color: var(--gitpulse-success);
    background: var(--gitpulse-success);
    color: #fff;
  }

  &.is-loading {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.review-item__thread-label {
  font-size: 0.7rem;
  color: var(--gitpulse-text-muted);
  white-space: nowrap;
}

// Dark mode adjustments
html.dark .review-item__thread-toggle {
  &:hover:not(:disabled) {
    border-color: var(--gitpulse-success);
    color: var(--gitpulse-success);
    background: color-mix(in srgb, var(--gitpulse-success) 16%, transparent);
  }

  &.is-resolved {
    border-color: var(--gitpulse-success);
    background: color-mix(in srgb, var(--gitpulse-success) 85%, transparent);
    color: #fff;
  }
}

.review-item__comment {
  min-width: 0;
}

.review-item__comment + .review-item__comment {
  margin-top: 1.125rem;
  padding-top: 1.125rem;
  border-top: 1px dashed var(--gitpulse-border);
}

.review-item__diff {
  min-width: 0;
}

.review-item__diff + .review-item__comment-meta {
  margin-top: 0.75rem;
}

.review-item__comment-body {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid color-mix(in srgb, var(--gitpulse-border) 60%, transparent);
  min-width: 0;
}

.review-item__suggestion {
  margin: 0.625rem 0;
}

.review-item__dismissal-message :deep(*:last-child),
.review-item__comment-body :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
