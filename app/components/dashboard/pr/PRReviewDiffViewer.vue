<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next';
import {
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from 'vue';

import PRReviewInlineComment from '~/components/dashboard/pr/PRReviewInlineComment.vue';
import type {
  PRReviewDiffSection,
  PRReviewDiffRow,
  PRReviewDraftComment,
} from '~/composables/usePRReview';

const props = defineProps<{
  sections: PRReviewDiffSection[];
  activeFilename: string;
  draftComments: PRReviewDraftComment[];
  activeDraftTarget: { path: string; line: number } | null;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'open-draft-editor', path: string, line: number): void;
  (e: 'close-draft-editor'): void;
  (e: 'save-draft-comment', path: string, line: number, position: number, body: string): void;
  (e: 'remove-draft-comment', id: string): void;
  (e: 'visible-file-changed', filename: string): void;
}>();

const collapsedFiles = ref(new Set<string>());

const toggleFileCollapse = (filename: string) => {
  const updated = new Set(collapsedFiles.value);
  if (updated.has(filename)) {
    updated.delete(filename);
  } else {
    updated.add(filename);
  }
  collapsedFiles.value = updated;
};

type CodeTokenKind =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'function'
  | 'property';

interface CodeToken {
  key: string;
  text: string;
  kind: CodeTokenKind;
}

const languageByExtension: Record<string, string> = {
  bash: 'bash',
  cjs: 'javascript',
  css: 'css',
  go: 'go',
  h: 'c',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  md: 'markdown',
  mjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'vue',
  yaml: 'yaml',
  yml: 'yaml',
};

const keywordSet = new Set([
  'and',
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'func',
  'function',
  'if',
  'import',
  'in',
  'interface',
  'is',
  'let',
  'match',
  'new',
  'nil',
  'not',
  'null',
  'or',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'select',
  'static',
  'struct',
  'switch',
  'throw',
  'true',
  'try',
  'type',
  'undefined',
  'var',
  'where',
  'while',
  'with',
]);

const hashCommentLanguages = new Set(['bash', 'python', 'ruby', 'yaml']);
const tokenPattern =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$-]*\b|[{}()[\].,;:+\-*/%=&|!<>?]+)/g;

const { t } = useI18n();
const scrollContainer = useTemplateRef<HTMLElement>('scrollContainer');
const sectionElements = new Map<string, HTMLElement>();
const isProgrammaticScroll = shallowRef(false);
const lastScrollSyncedFilename = shallowRef<string | null>(null);
let programmaticScrollTimer: number | undefined;

const setFileSectionElement = (
  filename: string,
  element: Element | ComponentPublicInstance | null
) => {
  if (element instanceof HTMLElement) {
    sectionElements.set(filename, element);
  } else {
    sectionElements.delete(filename);
  }
};

const getDraftsForFile = (filename: string) =>
  props.draftComments.filter((comment) => comment.path === filename);

const getDraftForLine = (path: string, line: number | null) => {
  if (!line) {
    return undefined;
  }

  return props.draftComments.find((comment) => comment.path === path && comment.line === line);
};

const isActiveDraftTarget = (path: string, line: number | null) =>
  Boolean(line && props.activeDraftTarget?.path === path && props.activeDraftTarget.line === line);

const handleSaveDraft = (rows: PRReviewDiffRow[], path: string, line: number, body: string) => {
  const row = rows.find((diffRow) => diffRow.newLineNumber === line);

  if (!row?.position) {
    return;
  }

  emit('save-draft-comment', path, line, row.position, body);
};

const getRowSideClass = (row: PRReviewDiffRow, side: 'old' | 'new') => [
  'pr-review-diff-viewer__pane',
  `pr-review-diff-viewer__pane--${side}`,
  `pr-review-diff-viewer__pane--${row.type}`,
  {
    'pr-review-diff-viewer__pane--empty':
      (side === 'old' && row.type === 'add') || (side === 'new' && row.type === 'delete'),
    'pr-review-diff-viewer__pane--commentable': side === 'new' && row.isCommentable,
  },
];

const getSideContent = (row: PRReviewDiffRow, side: 'old' | 'new') => {
  if (side === 'old' && row.type === 'add') return '';
  if (side === 'new' && row.type === 'delete') return '';
  return row.content || ' ';
};

const getFileLanguage = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return languageByExtension[extension] ?? 'text';
};

const isInsideQuote = (content: string, targetIndex: number) => {
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = 0; index < targetIndex; index += 1) {
    const character = content[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    }
  }

  return Boolean(quote);
};

const findCommentStart = (content: string, language: string) => {
  const trimmedContent = content.trimStart();

  if (
    trimmedContent.startsWith('/*') ||
    trimmedContent.startsWith('*') ||
    trimmedContent.startsWith('<!--')
  ) {
    return content.length - trimmedContent.length;
  }

  const slashCommentIndex = content.indexOf('//');
  if (slashCommentIndex >= 0 && !isInsideQuote(content, slashCommentIndex)) {
    return slashCommentIndex;
  }

  const hashCommentIndex = content.indexOf('#');
  if (
    hashCommentLanguages.has(language) &&
    hashCommentIndex >= 0 &&
    !isInsideQuote(content, hashCommentIndex)
  ) {
    return hashCommentIndex;
  }

  return -1;
};

const getTokenKind = (content: string, match: string, index: number): CodeTokenKind => {
  if (/^["'`]/.test(match)) return 'string';
  if (/^\d/.test(match)) return 'number';
  if (/^[{}()[\].,;:+\-*/%=&|!<>?]+$/.test(match)) return 'operator';
  if (keywordSet.has(match)) return 'keyword';

  const nextCharacter = content.slice(index + match.length).trimStart()[0];
  if (nextCharacter === '(') return 'function';
  if (content[index - 1] === '.') return 'property';

  return 'plain';
};

const tokenizeCode = (content: string, filename: string): CodeToken[] => {
  const language = getFileLanguage(filename);
  const commentStart = findCommentStart(content, language);
  const codeContent = commentStart >= 0 ? content.slice(0, commentStart) : content;
  const commentContent = commentStart >= 0 ? content.slice(commentStart) : '';
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of codeContent.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const text = match[0];

    if (index > cursor) {
      tokens.push({
        key: `plain-${cursor}`,
        text: codeContent.slice(cursor, index),
        kind: 'plain',
      });
    }

    const kind = getTokenKind(codeContent, text, index);
    tokens.push({ key: `${kind}-${index}`, text, kind });
    cursor = index + text.length;
  }

  if (cursor < codeContent.length) {
    tokens.push({ key: `plain-${cursor}`, text: codeContent.slice(cursor), kind: 'plain' });
  }

  if (commentContent) {
    tokens.push({ key: `comment-${commentStart}`, text: commentContent, kind: 'comment' });
  }

  return tokens.length ? tokens : [{ key: 'plain-0', text: content, kind: 'plain' }];
};

const scrollToActiveFile = async () => {
  await nextTick();

  const target = sectionElements.get(props.activeFilename);
  const container = scrollContainer.value;

  if (!target || !container) {
    return;
  }

  isProgrammaticScroll.value = true;
  window.clearTimeout(programmaticScrollTimer);

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = container.scrollTop + targetRect.top - containerRect.top;

  container.scrollTo({ top, behavior: 'auto' });

  programmaticScrollTimer = window.setTimeout(() => {
    isProgrammaticScroll.value = false;
  }, 80);
};

const handleScroll = () => {
  const container = scrollContainer.value;

  if (!container || isProgrammaticScroll.value) {
    return;
  }

  const containerTop = container.getBoundingClientRect().top;
  const threshold = containerTop + 16;
  let visibleFilename = props.sections[0]?.file.filename ?? '';

  for (const section of props.sections) {
    const element = sectionElements.get(section.file.filename);

    if (element && element.getBoundingClientRect().top <= threshold) {
      visibleFilename = section.file.filename;
    }
  }

  if (visibleFilename && visibleFilename !== props.activeFilename) {
    lastScrollSyncedFilename.value = visibleFilename;
    emit('visible-file-changed', visibleFilename);
  }
};

watch(
  () => props.activeFilename,
  (activeFilename) => {
    if (activeFilename === lastScrollSyncedFilename.value) {
      lastScrollSyncedFilename.value = null;
      return;
    }

    scrollToActiveFile();
  }
);

onBeforeUnmount(() => {
  window.clearTimeout(programmaticScrollTimer);
});
</script>

<template>
  <section class="pr-review-diff-viewer">
    <div v-if="!sections.length" class="pr-review-diff-viewer__empty">
      {{ t('prReview.selectFile') }}
    </div>

    <div v-else ref="scrollContainer" class="pr-review-diff-viewer__body" @scroll="handleScroll">
      <article
        v-for="section in sections"
        :key="section.file.filename"
        :ref="(element) => setFileSectionElement(section.file.filename, element)"
        class="pr-review-diff-viewer__file-section"
        :class="{
          'pr-review-diff-viewer__file-section--active': section.file.filename === activeFilename,
          'pr-review-diff-viewer__file-section--collapsed': collapsedFiles.has(
            section.file.filename
          ),
        }"
      >
        <div
          class="pr-review-diff-viewer__header"
          role="button"
          tabindex="0"
          :aria-expanded="!collapsedFiles.has(section.file.filename)"
          :aria-label="section.file.filename"
          @click="toggleFileCollapse(section.file.filename)"
          @keydown.enter.prevent="toggleFileCollapse(section.file.filename)"
          @keydown.space.prevent="toggleFileCollapse(section.file.filename)"
        >
          <ChevronRightIcon
            :size="14"
            class="pr-review-diff-viewer__header-chevron"
            :class="{
              'pr-review-diff-viewer__header-chevron--expanded': !collapsedFiles.has(
                section.file.filename
              ),
            }"
            aria-hidden="true"
          />
          <div class="pr-review-diff-viewer__header-info">
            <h2 class="title is-6 mb-1">{{ section.file.filename }}</h2>
            <p v-if="section.file.previous_filename" class="is-size-7 has-text-grey mb-0">
              {{ t('prReview.renamedFrom', { filename: section.file.previous_filename }) }}
            </p>
          </div>
          <div class="tags mb-0">
            <span
              class="tag"
              :class="`pr-review-diff-viewer__status-tag--${section.file.status}`"
              >{{ section.file.status }}</span
            >
            <span class="tag is-success is-light">+{{ section.file.additions }}</span>
            <span class="tag is-danger is-light">-{{ section.file.deletions }}</span>
          </div>
        </div>

        <template v-if="!collapsedFiles.has(section.file.filename)">
          <div
            v-if="!section.file.patch"
            class="pr-review-diff-viewer__empty pr-review-diff-viewer__empty--file"
          >
            <p class="mb-2">{{ t('prReview.patchUnavailable') }}</p>
            <p class="is-size-7 has-text-grey mb-0">{{ t('prReview.patchUnavailableHint') }}</p>
          </div>

          <template v-else>
            <template v-for="row in section.rows" :key="`${section.file.filename}:${row.key}`">
              <div v-if="row.type === 'hunk'" class="pr-review-diff-viewer__hunk">
                <code>{{ row.content }}</code>
              </div>

              <div v-else class="pr-review-diff-viewer__split-row">
                <div :class="getRowSideClass(row, 'old')">
                  <span class="pr-review-diff-viewer__line-number">{{
                    row.oldLineNumber ?? ''
                  }}</span>
                  <code class="pr-review-diff-viewer__code">
                    <span
                      v-for="token in tokenizeCode(
                        getSideContent(row, 'old'),
                        section.file.filename
                      )"
                      :key="token.key"
                      class="pr-review-diff-viewer__token"
                      :class="`pr-review-diff-viewer__token--${token.kind}`"
                      >{{ token.text }}</span
                    >
                  </code>
                </div>

                <span class="pr-review-diff-viewer__split-divider" aria-hidden="true"></span>

                <div :class="getRowSideClass(row, 'new')">
                  <span class="pr-review-diff-viewer__line-number">
                    <span class="pr-review-diff-viewer__line-num">{{
                      row.newLineNumber ?? ''
                    }}</span>
                    <button
                      class="pr-review-diff-viewer__comment-button"
                      type="button"
                      :aria-label="
                        row.newLineNumber
                          ? t('prReview.addLineCommentForLine', { line: row.newLineNumber })
                          : t('prReview.addLineComment')
                      "
                      :disabled="!row.isCommentable || !row.newLineNumber || submitting"
                      :title="
                        row.isCommentable
                          ? t('prReview.addLineComment')
                          : t('prReview.lineNotCommentable')
                      "
                      @click="
                        row.newLineNumber
                          ? emit('open-draft-editor', section.file.filename, row.newLineNumber)
                          : undefined
                      "
                    >
                      +
                    </button>
                  </span>
                  <code class="pr-review-diff-viewer__code">
                    <span
                      v-for="token in tokenizeCode(
                        getSideContent(row, 'new'),
                        section.file.filename
                      )"
                      :key="token.key"
                      class="pr-review-diff-viewer__token"
                      :class="`pr-review-diff-viewer__token--${token.kind}`"
                      >{{ token.text }}</span
                    >
                  </code>
                </div>
              </div>

              <PRReviewInlineComment
                v-if="
                  row.newLineNumber && isActiveDraftTarget(section.file.filename, row.newLineNumber)
                "
                :path="section.file.filename"
                :line="row.newLineNumber"
                :existing-body="getDraftForLine(section.file.filename, row.newLineNumber)?.body"
                :submitting="submitting"
                @save="(path, line, body) => handleSaveDraft(section.rows, path, line, body)"
                @cancel="emit('close-draft-editor')"
              />
            </template>
          </template>

          <div
            v-if="getDraftsForFile(section.file.filename).length"
            class="pr-review-diff-viewer__drafts"
          >
            <h3 class="title is-6 mb-2">{{ t('prReview.pendingForFile') }}</h3>
            <div
              v-for="comment in getDraftsForFile(section.file.filename)"
              :key="comment.id"
              class="pr-review-diff-viewer__draft"
            >
              <div>
                <p class="is-size-7 has-text-grey mb-1">
                  {{ t('prReview.lineLabel', { line: comment.line }) }}
                </p>
                <p class="mb-0">{{ comment.body }}</p>
              </div>
              <button
                class="delete is-small"
                type="button"
                :aria-label="t('prReview.removeDraft')"
                :disabled="submitting"
                @click="emit('remove-draft-comment', comment.id)"
              ></button>
            </div>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped lang="scss">
.pr-review-diff-viewer {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.pr-review-diff-viewer__header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 2.75rem;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  border-left: 3px solid transparent;
  outline: none;
}

.pr-review-diff-viewer__header:hover {
  background: var(--gitpulse-surface-hover);
}

.pr-review-diff-viewer__header:focus-visible {
  box-shadow: inset 0 0 0 2px var(--gitpulse-focus-ring);
}

.pr-review-diff-viewer__file-section--active .pr-review-diff-viewer__header {
  border-left-color: var(--gitpulse-info);
}

.pr-review-diff-viewer__file-section--collapsed .pr-review-diff-viewer__header {
  border-bottom-color: transparent;
}

.pr-review-diff-viewer__header-chevron {
  flex: none;
  color: var(--gitpulse-text-muted);
  transition: transform 0.15s ease;
}

.pr-review-diff-viewer__header-chevron--expanded {
  transform: rotate(90deg);
}

.pr-review-diff-viewer__header-info {
  min-width: 0;
  flex: 1;
}

.pr-review-diff-viewer__header-info .title {
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Consolas,
    Liberation Mono,
    Menlo,
    monospace;
  font-size: 0.82rem;
}

.pr-review-diff-viewer__body {
  overflow: auto;
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  overscroll-behavior: contain;
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Consolas,
    Liberation Mono,
    Menlo,
    monospace;
  font-size: 12px;
  line-height: 1.45;
}

.pr-review-diff-viewer__file-section {
  min-width: 100%;
  border-bottom: 1px solid var(--gitpulse-border);
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

.pr-review-diff-viewer__status-tag--added {
  background: var(--gitpulse-success-soft);
  color: var(--gitpulse-success);
}

.pr-review-diff-viewer__status-tag--modified {
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.pr-review-diff-viewer__status-tag--removed {
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
}

.pr-review-diff-viewer__status-tag--renamed {
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
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
  font-style: italic;
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

.pr-review-diff-viewer__empty {
  margin: auto;
  max-width: 34rem;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  text-align: center;
}

.pr-review-diff-viewer__empty--file {
  margin: 0 auto;
}

.pr-review-diff-viewer__drafts {
  max-height: 10rem;
  overflow-y: auto;
  border-top: 1px solid var(--gitpulse-border);
  padding: 0.75rem;
  background: var(--gitpulse-draft-bg);
}

.pr-review-diff-viewer__draft {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--gitpulse-draft-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
}

.pr-review-diff-viewer__draft + .pr-review-diff-viewer__draft {
  margin-top: 0.75rem;
}
</style>
