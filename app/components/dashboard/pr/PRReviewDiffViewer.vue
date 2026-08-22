<script setup lang="ts">
import { ChevronRightIcon } from '@lucide/vue';
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
const { resolveDashboardUrlTarget, getDashboardUrlRoute, getPreferredDashboardUrlHref } =
  useDashboardUrlNavigation();
const { opensGitHubLinks } = useGitHubLinkRouting();

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

const FILE_STATUS_LABEL_KEYS: Record<string, string> = {
  added: 'prReview.fileStatus.added',
  removed: 'prReview.fileStatus.removed',
  modified: 'prReview.fileStatus.modified',
  renamed: 'prReview.fileStatus.renamed',
  copied: 'prReview.fileStatus.copied',
  changed: 'prReview.fileStatus.changed',
};

const fileStatusLabel = (status: string) => {
  const key = FILE_STATUS_LABEL_KEYS[status];
  return key ? t(key) : status;
};

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
const stickySentinels = new Map<string, HTMLElement>();
const stuckHeaders = shallowRef(new Set<string>());
const isProgrammaticScroll = shallowRef(false);
const lastScrollSyncedFilename = shallowRef<string | null>(null);
let programmaticScrollTimer: number | undefined;
let scrollSyncFrame: number | undefined;
let stickyObserver: IntersectionObserver | undefined;

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

const isHeaderStuck = (filename: string) => stuckHeaders.value.has(filename);

const setStickySentinel = (filename: string, element: Element | ComponentPublicInstance | null) => {
  const previous = stickySentinels.get(filename);

  if (previous && previous !== element) {
    stickyObserver?.unobserve(previous);
    stickySentinels.delete(filename);
  }

  if (element instanceof HTMLElement) {
    stickySentinels.set(filename, element);
    stickyObserver?.observe(element);
    return;
  }

  if (stuckHeaders.value.has(filename)) {
    const nextStuck = new Set(stuckHeaders.value);
    nextStuck.delete(filename);
    stuckHeaders.value = nextStuck;
  }
};

const bindStickyObserver = (container: HTMLElement | null) => {
  stickyObserver?.disconnect();
  stickyObserver = undefined;

  if (!container || typeof IntersectionObserver === 'undefined') {
    return;
  }

  stickyObserver = new IntersectionObserver(
    (entries) => {
      const nextStuck = new Set(stuckHeaders.value);
      let changed = false;

      for (const entry of entries) {
        const filename = entry.target instanceof HTMLElement ? entry.target.dataset.filename : '';

        if (!filename) {
          continue;
        }

        const rootTop = entry.rootBounds?.top ?? 0;
        const stuck = !entry.isIntersecting && entry.boundingClientRect.top < rootTop;

        if (stuck) {
          if (!nextStuck.has(filename)) {
            nextStuck.add(filename);
            changed = true;
          }
        } else if (nextStuck.delete(filename)) {
          changed = true;
        }
      }

      if (changed) {
        stuckHeaders.value = nextStuck;
      }
    },
    { root: container, threshold: 0 }
  );

  for (const sentinel of stickySentinels.values()) {
    stickyObserver.observe(sentinel);
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

const getFilePreferredHref = (filename: string) => {
  const target = getFileNavigationTarget(filename);
  return target ? getPreferredDashboardUrlHref(target) : null;
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

watch(scrollContainer, (container) => bindStickyObserver(container), { flush: 'post' });

onBeforeUnmount(() => {
  window.clearTimeout(programmaticScrollTimer);
  if (scrollSyncFrame) {
    window.cancelAnimationFrame(scrollSyncFrame);
  }
  stickyObserver?.disconnect();
  stickyObserver = undefined;
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
          class="pr-review-diff-viewer__sticky-sentinel"
          aria-hidden="true"
          :data-filename="section.file.filename"
          :ref="(element) => setStickySentinel(section.file.filename, element)"
        ></div>
        <div
          class="pr-review-diff-viewer__header"
          :class="{ 'pr-review-diff-viewer__header--stuck': isHeaderStuck(section.file.filename) }"
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
            <h2 class="title is-6 mb-0">
              <a
                v-if="opensGitHubLinks && getFilePreferredHref(section.file.filename)"
                :href="getFilePreferredHref(section.file.filename)!"
                target="_blank"
                rel="noopener noreferrer"
                class="pr-review-diff-viewer__file-link"
                @click.stop
              >
                {{ section.file.filename }}
              </a>
              <NuxtLinkLocale
                v-else-if="getFileDashboardRoute(section.file.filename)"
                :to="getFileDashboardRoute(section.file.filename)!"
                class="pr-review-diff-viewer__file-link"
                @click.stop
              >
                {{ section.file.filename }}
              </NuxtLinkLocale>
              <span v-else>{{ section.file.filename }}</span>
            </h2>
            <p v-if="section.file.previous_filename" class="is-size-7 has-text-grey mb-0">
              {{ t('prReview.renamedFrom', { filename: section.file.previous_filename }) }}
            </p>
          </div>
          <div class="pr-review-diff-viewer__header-meta">
            <span
              class="pr-review-diff-viewer__status"
              :class="`pr-review-diff-viewer__status--${section.file.status}`"
            >
              {{ fileStatusLabel(section.file.status) }}
            </span>
            <span
              v-if="section.file.additions"
              class="pr-review-diff-viewer__stat pr-review-diff-viewer__stat--add"
            >
              +{{ section.file.additions }}
            </span>
            <span
              v-if="section.file.deletions"
              class="pr-review-diff-viewer__stat pr-review-diff-viewer__stat--delete"
            >
              -{{ section.file.deletions }}
            </span>
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
  background: var(--gitpulse-shell-bg);
  overflow: hidden;
}

.pr-review-diff-viewer__sticky-sentinel {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
  visibility: hidden;
}

.pr-review-diff-viewer__header {
  --pr-review-file-header-shadow: 0 6px 14px -6px color-mix(in srgb, #000 22%, transparent);

  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 2.75rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-bottom-color: var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  outline: none;
  font-size: 0.8125rem;
  line-height: 1.3;
  box-shadow: var(--pr-review-file-header-shadow);
}

html.dark .pr-review-diff-viewer__header {
  --pr-review-file-header-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.55);
}

.pr-review-diff-viewer__header:hover {
  background: color-mix(in srgb, var(--gitpulse-surface-muted) 86%, var(--gitpulse-text-strong));
}

.pr-review-diff-viewer__header:focus-visible {
  box-shadow:
    inset 0 0 0 2px var(--gitpulse-focus-ring),
    var(--pr-review-file-header-shadow);
}

.pr-review-diff-viewer__header--stuck {
  top: 0.5rem;
  margin: 0 0.75rem;
  border-color: var(--gitpulse-border-strong);
  border-radius: 999px;
  box-shadow:
    var(--pr-review-file-header-shadow),
    0 8px 20px -10px color-mix(in srgb, #000 28%, transparent);
}

.pr-review-diff-viewer__header--stuck:focus-visible {
  box-shadow:
    inset 0 0 0 2px var(--gitpulse-focus-ring),
    var(--pr-review-file-header-shadow),
    0 8px 20px -10px color-mix(in srgb, #000 28%, transparent);
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

.pr-review-diff-viewer__file-section--active {
  border-color: color-mix(in srgb, var(--gitpulse-info) 48%, var(--gitpulse-border));
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
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.pr-review-diff-viewer__header-info .title {
  font-size: 0.875rem;
}

.pr-review-diff-viewer__header-meta {
  flex: none;
  display: inline-flex;
  align-items: baseline;
  gap: 0.55rem;
  font-variant-numeric: tabular-nums;
}

.pr-review-diff-viewer__status,
.pr-review-diff-viewer__stat {
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
}

.pr-review-diff-viewer__status {
  color: var(--gitpulse-text-muted);
}

.pr-review-diff-viewer__status--added {
  color: var(--gitpulse-success);
}

.pr-review-diff-viewer__status--removed {
  color: var(--gitpulse-danger);
}

.pr-review-diff-viewer__status--modified,
.pr-review-diff-viewer__status--changed {
  color: var(--gitpulse-warning);
}

.pr-review-diff-viewer__status--renamed,
.pr-review-diff-viewer__status--copied {
  color: var(--gitpulse-purple);
}

.pr-review-diff-viewer__stat--add {
  color: var(--gitpulse-success);
}

.pr-review-diff-viewer__stat--delete {
  color: var(--gitpulse-danger);
}

.pr-review-diff-viewer__body {
  // Pinned to a fixed pixel width by the workspace while the panel grid
  // animates, so code lines never re-wrap mid-animation; the section's
  // overflow: hidden clips the overflow instead.
  width: var(--pr-review-center-pin, auto);
  overflow: auto;
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  -ms-overflow-style: none;
  overscroll-behavior: contain;
  font-size: var(--gitpulse-pr-review-code-font-size, 12px);
  line-height: 1.45;
  scrollbar-width: none;
}

.pr-review-diff-viewer__body::-webkit-scrollbar {
  display: none;
}

.pr-review-diff-viewer__file-section {
  // clip (not hidden) keeps File Header sticky to the pane scroller.
  position: relative;
  min-width: 0;
  overflow: clip;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface);
  box-shadow: var(--gitpulse-shadow-card);
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
