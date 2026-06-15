<script setup lang="ts">
import { ChevronRightIcon } from 'lucide-vue-next';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  ref,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
} from 'vue';

import PRReviewVirtualDiffRows from '~/components/dashboard/pr/PRReviewVirtualDiffRows.vue';
import type {
  PRReviewDiffSection,
  PRReviewDraftComment,
  PRReviewCommentThread,
  PRReviewFile,
} from '~/composables/usePRReview';

const EMPTY_DRAFT_COMMENTS: PRReviewDraftComment[] = [];
const EMPTY_REVIEW_COMMENT_THREADS: PRReviewCommentThread[] = [];

const props = defineProps<{
  repoOwner: string;
  repoName: string;
  sections: PRReviewDiffSection[];
  activeFilename: string;
  draftComments: PRReviewDraftComment[];
  reviewCommentThreads: PRReviewCommentThread[];
  activeDraftTarget: { path: string; line: number } | null;
  submitting: boolean;
  resolvingReviewThreadId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'open-draft-editor', path: string, line: number): void;
  (e: 'close-draft-editor'): void;
  (e: 'save-draft-comment', path: string, line: number, position: number, body: string): void;
  (e: 'remove-draft-comment', id: string): void;
  (e: 'visible-file-changed', filename: string): void;
  (e: 'toggle-review-thread', threadId: string, resolved: boolean): void;
}>();

const collapsedFiles = ref(new Set<string>());
const inlineDraftBodies = shallowRef(new Map<string, string>());
const { t } = useI18n();
const { resolveDashboardUrlTarget, getDashboardUrlRoute, trackDashboardUrlNavigation } =
  useDashboardUrlNavigation();

const draftsByFile = computed(() => {
  const grouped = new Map<string, PRReviewDraftComment[]>();

  for (const comment of props.draftComments) {
    const comments = grouped.get(comment.path) ?? [];
    comments.push(comment);
    grouped.set(comment.path, comments);
  }

  return grouped;
});

const reviewThreadsByFile = computed(() => {
  const grouped = new Map<string, PRReviewCommentThread[]>();

  for (const thread of props.reviewCommentThreads) {
    const threads = grouped.get(thread.path) ?? [];
    threads.push(thread);
    grouped.set(thread.path, threads);
  }

  return grouped;
});

const toggleFileCollapse = (filename: string) => {
  const updated = new Set(collapsedFiles.value);
  if (updated.has(filename)) {
    updated.delete(filename);
  } else {
    updated.add(filename);
  }
  collapsedFiles.value = updated;
};

const scrollContainer = useTemplateRef<HTMLElement>('scrollContainer');
const sectionElements = new Map<string, HTMLElement>();
const isProgrammaticScroll = shallowRef(false);
const lastScrollSyncedFilename = shallowRef<string | null>(null);
let programmaticScrollTimer: number | undefined;
let scrollSyncFrame: number | undefined;

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
  draftsByFile.value.get(filename) ?? EMPTY_DRAFT_COMMENTS;

const getReviewThreadsForFile = (filename: string) =>
  reviewThreadsByFile.value.get(filename) ?? EMPTY_REVIEW_COMMENT_THREADS;

const fileNavigationTargets = computed(() => {
  const targets = new Map<string, NonNullable<ReturnType<typeof resolveDashboardUrlTarget>>>();

  for (const section of props.sections) {
    const sourceUrl = section.file.blob_url || section.file.raw_url;
    const target = resolveDashboardUrlTarget(sourceUrl);

    if (target?.type === 'file') {
      targets.set(section.file.filename, target);
    }
  }

  return targets;
});

const getFileNavigationTarget = (filename: string) =>
  fileNavigationTargets.value.get(filename) ?? null;

const getFileDashboardRoute = (filename: string) => {
  const target = getFileNavigationTarget(filename);
  return target ? getDashboardUrlRoute(target) : null;
};

const trackFileNavigation = (file: PRReviewFile) => {
  const target = getFileNavigationTarget(file.filename);
  if (target) {
    trackDashboardUrlNavigation(target);
  }
};

const getDraftKey = (path: string, line: number) => `${path}:${line}`;

const getSavedDraftBody = (path: string, line: number) =>
  getDraftsForFile(path).find((comment) => comment.line === line)?.body ?? '';

const ensureInlineDraftBody = (path: string, line: number) => {
  const key = getDraftKey(path, line);

  if (inlineDraftBodies.value.has(key)) {
    return;
  }

  const nextBodies = new Map(inlineDraftBodies.value);
  nextBodies.set(key, getSavedDraftBody(path, line));
  inlineDraftBodies.value = nextBodies;
};

const getInlineDraftBodyForFile = (filename: string) => {
  const target = props.activeDraftTarget;

  if (!target || target.path !== filename) {
    return '';
  }

  return (
    inlineDraftBodies.value.get(getDraftKey(target.path, target.line)) ??
    getSavedDraftBody(target.path, target.line)
  );
};

const setInlineDraftBodyForFile = (filename: string, body: string) => {
  const target = props.activeDraftTarget;

  if (!target || target.path !== filename) {
    return;
  }

  const nextBodies = new Map(inlineDraftBodies.value);
  nextBodies.set(getDraftKey(target.path, target.line), body);
  inlineDraftBodies.value = nextBodies;
};

const clearInlineDraftBody = (target = props.activeDraftTarget) => {
  if (!target) {
    return;
  }

  const nextBodies = new Map(inlineDraftBodies.value);
  nextBodies.delete(getDraftKey(target.path, target.line));
  inlineDraftBodies.value = nextBodies;
};

const handleOpenDraftEditor = (path: string, line: number) => {
  ensureInlineDraftBody(path, line);
  emit('open-draft-editor', path, line);
};

const handleCloseDraftEditor = () => {
  clearInlineDraftBody();
  emit('close-draft-editor');
};

const handleSaveDraftComment = (path: string, line: number, position: number, body: string) => {
  clearInlineDraftBody({ path, line });
  emit('save-draft-comment', path, line, position, body);
};

const handleRemoveDraftComment = (id: string) => {
  const nextBodies = new Map(inlineDraftBodies.value);
  nextBodies.delete(id);
  inlineDraftBodies.value = nextBodies;
  emit('remove-draft-comment', id);
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

const syncVisibleFile = () => {
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

const handleScroll = () => {
  if (isProgrammaticScroll.value || scrollSyncFrame) {
    return;
  }

  scrollSyncFrame = window.requestAnimationFrame(() => {
    scrollSyncFrame = undefined;
    syncVisibleFile();
  });
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

watch(
  () => props.activeDraftTarget,
  (target) => {
    if (target) {
      ensureInlineDraftBody(target.path, target.line);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.clearTimeout(programmaticScrollTimer);
  if (scrollSyncFrame) {
    window.cancelAnimationFrame(scrollSyncFrame);
  }
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
            <h2 class="title is-6 mb-1">
              <NuxtLinkLocale
                v-if="getFileDashboardRoute(section.file.filename)"
                :to="getFileDashboardRoute(section.file.filename)!"
                class="pr-review-diff-viewer__file-link"
                @click.stop="trackFileNavigation(section.file)"
              >
                {{ section.file.filename }}
              </NuxtLinkLocale>
              <span v-else>{{ section.file.filename }}</span>
            </h2>
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

        <div
          v-if="!section.file.patch"
          class="pr-review-diff-viewer__empty pr-review-diff-viewer__empty--file"
        >
          <p class="mb-2">{{ t('prReview.patchUnavailable') }}</p>
          <p class="is-size-7 has-text-grey mb-0">{{ t('prReview.patchUnavailableHint') }}</p>
        </div>

        <template v-else>
          <PRReviewVirtualDiffRows
            :rows="section.rows"
            :filename="section.file.filename"
            :repo-owner="repoOwner"
            :repo-name="repoName"
            :review-comment-threads="getReviewThreadsForFile(section.file.filename)"
            :active-draft-target="activeDraftTarget"
            :active-draft-body="getInlineDraftBodyForFile(section.file.filename)"
            :submitting="submitting"
            :resolving-review-thread-id="resolvingReviewThreadId"
            :scroll-container="scrollContainer"
            @open-draft-editor="handleOpenDraftEditor"
            @close-draft-editor="handleCloseDraftEditor"
            @update-active-draft-body="
              (body) => setInlineDraftBodyForFile(section.file.filename, body)
            "
            @save-draft-comment="handleSaveDraftComment"
            @toggle-review-thread="emit('toggle-review-thread', $event.threadId, $event.resolved)"
          />
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
              @click="handleRemoveDraftComment(comment.id)"
            ></button>
          </div>
        </div>
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

.pr-review-diff-viewer__file-link {
  color: inherit;
  text-decoration: none;
}

.pr-review-diff-viewer__file-link:hover,
.pr-review-diff-viewer__file-link:focus-visible {
  color: var(--gitpulse-link);
  text-decoration: underline;
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
  font-size: 0.82rem;
}

.pr-review-diff-viewer__body {
  overflow: auto;
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  -ms-overflow-style: none;
  overscroll-behavior: contain;
  font-size: 12px;
  line-height: 1.45;
  scrollbar-width: none;
}

.pr-review-diff-viewer__body::-webkit-scrollbar {
  display: none;
}

.pr-review-diff-viewer__file-section {
  min-width: 100%;
  border-bottom: 1px solid var(--gitpulse-border);
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
