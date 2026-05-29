<script setup lang="ts">
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-vue-next';
import { computed, shallowRef } from 'vue';

import type { PRReviewDraftComment, PRReviewEvent } from '~/composables/usePRReview';

defineProps<{
  event: PRReviewEvent;
  body: string;
  pendingCommentCount: number;
  draftComments: PRReviewDraftComment[];
  canSubmit: boolean;
  submitting: boolean;
  errorMessage: string;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:event', event: PRReviewEvent): void;
  (e: 'update:body', body: string): void;
  (e: 'update:collapsed', collapsed: boolean): void;
  (e: 'submit'): void;
  (e: 'remove-draft-comment', id: string): void;
}>();

const { t } = useI18n();

const expandedSections = shallowRef(new Set(['decision', 'summary', 'drafts']));

const reviewEvents: { value: PRReviewEvent; labelKey: string; icon: typeof MessageSquareIcon }[] = [
  { value: 'COMMENT', labelKey: 'prReview.eventComment', icon: MessageSquareIcon },
  { value: 'APPROVE', labelKey: 'prReview.eventApprove', icon: CheckCircle2Icon },
  { value: 'REQUEST_CHANGES', labelKey: 'prReview.eventRequestChanges', icon: XCircleIcon },
];

const submitClass = computed(() => ({
  'pr-review-submit-bar__submit--approve': false,
}));

const isSectionExpanded = (section: string) => expandedSections.value.has(section);

const toggleSection = (section: string) => {
  const nextSections = new Set(expandedSections.value);

  if (nextSections.has(section)) {
    nextSections.delete(section);
  } else {
    nextSections.add(section);
  }

  expandedSections.value = nextSections;
};

const handleBodyInput = (event: Event) => {
  emit('update:body', (event.target as HTMLTextAreaElement).value);
};
</script>

<template>
  <aside :class="['pr-review-submit-bar', { 'pr-review-submit-bar--collapsed': collapsed }]">
    <button
      v-if="collapsed"
      type="button"
      class="pr-review-submit-bar__collapsed-handle"
      :aria-label="t('prReview.expandReviewPanel')"
      :title="t('prReview.expandReviewPanel')"
      @click="emit('update:collapsed', false)"
    >
      <ChevronLeftIcon :size="16" aria-hidden="true" />
      <span>{{ t('prReview.reviewPanel') }}</span>
      <strong v-if="pendingCommentCount">{{ pendingCommentCount }}</strong>
    </button>

    <template v-else>
      <div class="pr-review-submit-bar__header">
        <div class="pr-review-submit-bar__header-title">
          <MessageSquareIcon :size="16" aria-hidden="true" />
          <div>
            <h2 class="title is-6 mb-0">{{ t('prReview.reviewPanel') }}</h2>
            <p class="is-size-7 has-text-grey mb-0">
              {{ t('prReview.pendingComments', { count: pendingCommentCount }) }}
            </p>
          </div>
        </div>
        <button
          class="pr-review-submit-bar__collapse-button"
          type="button"
          :aria-label="t('prReview.collapseReviewPanel')"
          :title="t('prReview.collapseReviewPanel')"
          @click="emit('update:collapsed', true)"
        >
          <ChevronRightIcon :size="16" aria-hidden="true" />
        </button>
      </div>

      <div class="pr-review-submit-bar__body">
        <section class="pr-review-submit-bar__section">
          <button
            class="pr-review-submit-bar__section-header"
            type="button"
            @click="toggleSection('decision')"
          >
            <ChevronDownIcon
              :size="14"
              :class="[
                'pr-review-submit-bar__section-chevron',
                {
                  'pr-review-submit-bar__section-chevron--collapsed':
                    !isSectionExpanded('decision'),
                },
              ]"
              aria-hidden="true"
            />
            {{ t('prReview.reviewEvent') }}
          </button>
          <div v-if="isSectionExpanded('decision')" class="pr-review-submit-bar__section-body">
            <label
              v-for="reviewEvent in reviewEvents"
              :key="reviewEvent.value"
              :class="[
                'pr-review-submit-bar__event-option',
                { 'pr-review-submit-bar__event-option--active': event === reviewEvent.value },
              ]"
            >
              <input
                type="radio"
                name="pr-review-event"
                :checked="event === reviewEvent.value"
                :disabled="submitting"
                @change="emit('update:event', reviewEvent.value)"
              />
              <component :is="reviewEvent.icon" :size="14" aria-hidden="true" />
              {{ t(reviewEvent.labelKey) }}
            </label>
          </div>
        </section>

        <section class="pr-review-submit-bar__section">
          <button
            class="pr-review-submit-bar__section-header"
            type="button"
            @click="toggleSection('summary')"
          >
            <ChevronDownIcon
              :size="14"
              :class="[
                'pr-review-submit-bar__section-chevron',
                {
                  'pr-review-submit-bar__section-chevron--collapsed': !isSectionExpanded('summary'),
                },
              ]"
              aria-hidden="true"
            />
            {{ t('prReview.reviewBody') }}
          </button>
          <div v-if="isSectionExpanded('summary')" class="pr-review-submit-bar__section-body">
            <textarea
              class="textarea pr-review-submit-bar__textarea"
              :value="body"
              rows="6"
              :placeholder="t('prReview.reviewBodyPlaceholder')"
              :disabled="submitting"
              @input="handleBodyInput"
            />
            <p class="help mb-0">{{ t('prReview.bodyRequiredHint') }}</p>
          </div>
        </section>

        <section class="pr-review-submit-bar__section">
          <button
            class="pr-review-submit-bar__section-header"
            type="button"
            @click="toggleSection('drafts')"
          >
            <ChevronDownIcon
              :size="14"
              :class="[
                'pr-review-submit-bar__section-chevron',
                {
                  'pr-review-submit-bar__section-chevron--collapsed': !isSectionExpanded('drafts'),
                },
              ]"
              aria-hidden="true"
            />
            {{ t('prReview.pendingDrafts') }}
            <span class="pr-review-submit-bar__count">{{ draftComments.length }}</span>
          </button>
          <div v-if="isSectionExpanded('drafts')" class="pr-review-submit-bar__section-body">
            <p v-if="!draftComments.length" class="pr-review-submit-bar__empty mb-0">
              {{ t('prReview.noPendingDrafts') }}
            </p>
            <div
              v-for="comment in draftComments"
              :key="comment.id"
              class="pr-review-submit-bar__draft"
            >
              <div class="pr-review-submit-bar__draft-copy">
                <p class="pr-review-submit-bar__draft-path mb-1">
                  {{ comment.path }}:{{ comment.line }}
                </p>
                <p class="pr-review-submit-bar__draft-body mb-0">{{ comment.body }}</p>
              </div>
              <button
                class="pr-review-submit-bar__delete-button"
                type="button"
                :aria-label="t('prReview.removeDraft')"
                :disabled="submitting"
                @click="emit('remove-draft-comment', comment.id)"
              >
                <Trash2Icon :size="14" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="pr-review-submit-bar__footer">
        <div v-if="errorMessage" class="notification is-danger is-light py-2 px-3 mb-3">
          <p class="is-size-7">{{ errorMessage }}</p>
        </div>
        <button
          class="button is-link is-fullwidth"
          type="button"
          :class="[{ 'is-loading': submitting }, submitClass]"
          :disabled="!canSubmit || submitting"
          @click="emit('submit')"
        >
          {{ t('prReview.submitReview') }}
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped lang="scss">
.pr-review-submit-bar {
  height: 100%;
  min-width: 0;
  border-left: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
}

.pr-review-submit-bar--collapsed {
  background: var(--gitpulse-surface);
}

.pr-review-submit-bar__header,
.pr-review-submit-bar__footer {
  padding: 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
}

.pr-review-submit-bar__header {
  min-height: 3.4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pr-review-submit-bar__header-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pr-review-submit-bar__header-title .title {
  font-size: 0.88rem;
}

.pr-review-submit-bar__collapse-button,
.pr-review-submit-bar__delete-button,
.pr-review-submit-bar__collapsed-handle {
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  cursor: pointer;
}

.pr-review-submit-bar__collapse-button,
.pr-review-submit-bar__delete-button {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pr-review-submit-bar__collapse-button:hover,
.pr-review-submit-bar__delete-button:hover {
  background: var(--gitpulse-surface-hover);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.pr-review-submit-bar__collapsed-handle {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
}

.pr-review-submit-bar__collapsed-handle span {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pr-review-submit-bar__collapsed-handle strong {
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 50%;
  background: var(--gitpulse-draft-bg);
  color: var(--gitpulse-warning);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
}

.pr-review-submit-bar__footer {
  border-top: 1px solid var(--gitpulse-border);
  border-bottom: 0;
}

.pr-review-submit-bar__body {
  overflow-y: auto;
  flex: 1;
  padding: 0.75rem;
}

.pr-review-submit-bar__section {
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.pr-review-submit-bar__section + .pr-review-submit-bar__section {
  margin-top: 0.75rem;
}

.pr-review-submit-bar__section-header {
  width: 100%;
  min-height: 2.15rem;
  border: 0;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.65rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.pr-review-submit-bar__section-header:hover {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
}

.pr-review-submit-bar__section-chevron {
  transition: transform 0.15s ease;
}

.pr-review-submit-bar__section-chevron--collapsed {
  transform: rotate(-90deg);
}

.pr-review-submit-bar__section-body {
  padding: 0.65rem;
  border-top: 1px solid var(--gitpulse-border);
}

.pr-review-submit-bar__event-option {
  min-height: 2.15rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0 0.65rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.pr-review-submit-bar__event-option + .pr-review-submit-bar__event-option {
  margin-top: 0.45rem;
}

.pr-review-submit-bar__event-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.pr-review-submit-bar__event-option--active {
  border-color: var(--gitpulse-info);
  background: var(--gitpulse-info-soft);
  color: var(--gitpulse-info);
}

.pr-review-submit-bar__textarea {
  min-height: 8rem;
  border-radius: 6px;
  font-size: 0.82rem;
}

.pr-review-submit-bar__count {
  min-width: 1.25rem;
  height: 1.25rem;
  margin-left: auto;
  border-radius: 999px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
}

.pr-review-submit-bar__draft {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.65rem;
  border: 1px solid var(--gitpulse-draft-border);
  border-left: 3px solid var(--gitpulse-warning);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  overflow-wrap: anywhere;
}

.pr-review-submit-bar__draft + .pr-review-submit-bar__draft {
  margin-top: 0.5rem;
}

.pr-review-submit-bar__draft-copy {
  min-width: 0;
}

.pr-review-submit-bar__draft-path,
.pr-review-submit-bar__draft-body {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pr-review-submit-bar__draft-path {
  color: var(--gitpulse-text-muted);
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Consolas,
    Liberation Mono,
    Menlo,
    monospace;
  font-size: 0.7rem;
}

.pr-review-submit-bar__draft-body {
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.78rem;
}

.pr-review-submit-bar__empty {
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
}

.pr-review-submit-bar__submit--approve {
  background: var(--gitpulse-success);
  border-color: var(--gitpulse-success);
}
</style>
