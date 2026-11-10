<script setup lang="ts">
import { ChevronDownIcon, EyeOffIcon } from '@lucide/vue';
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  COMMENT_HIDDEN_REASONS,
  type CommentHiddenReason,
  type CommentModeration,
} from '#shared/types/comment-moderation';
import { useCommentModeration } from '~/composables/useCommentModeration';

// Kept in step with the fold's transition: the body leaves the DOM only after the
// reveal has closed, so a masked comment cannot be read from the page meanwhile.
const FOLD_MS = 240;

const { target, body } = defineProps<{ target?: CommentModeration; body?: string }>();
const { t } = useI18n();
const { stateFor } = useCommentModeration();
const state = computed(() => stateFor(target));
const minimized = computed(() => state.value.moderation?.isMinimized === true);
// GitHub has returned reason strings in both shapes; only the seven known
// classifiers are translated, so an unknown one never reaches the reader.
const reason = computed(() => {
  const classifier = state.value.moderation?.minimizedReason?.toUpperCase().replaceAll('-', '_');
  if (!classifier || !COMMENT_HIDDEN_REASONS.includes(classifier as CommentHiddenReason)) return '';
  return t(`commentModeration.reasons.${classifier}`);
});
const expanded = shallowRef(false);
const revealed = shallowRef(false);

let foldTimer: ReturnType<typeof setTimeout> | null = null;
const clearFoldTimer = () => {
  if (foldTimer) clearTimeout(foldTimer);
  foldTimer = null;
};
const setExpanded = (next: boolean) => {
  clearFoldTimer();
  expanded.value = next;
  if (next) {
    revealed.value = true;
    return;
  }
  foldTimer = setTimeout(() => {
    revealed.value = false;
    foldTimer = null;
  }, FOLD_MS);
};

watch(
  () => [
    target?.nodeId,
    state.value.moderation?.isMinimized,
    state.value.moderation?.minimizedReason,
  ],
  () => {
    clearFoldTimer();
    expanded.value = false;
    revealed.value = false;
  }
);
onScopeDispose(clearFoldTimer);
</script>

<template>
  <div v-if="minimized" class="comment-hidden">
    <div class="comment-hidden__notice">
      <span class="tag is-light comment-hidden__state">
        <EyeOffIcon class="comment-hidden__icon" :size="12" aria-hidden="true" />
        <span class="comment-hidden__label">{{ t('commentModeration.hidden') }}</span>
        <template v-if="reason">
          <span class="comment-hidden__divider" aria-hidden="true" />
          <span class="comment-hidden__reason">{{ reason }}</span>
        </template>
      </span>
      <button
        type="button"
        class="comment-hidden__toggle"
        :aria-expanded="expanded"
        @click="setExpanded(!expanded)"
      >
        <span>{{ t(expanded ? 'commentModeration.collapse' : 'commentModeration.expand') }}</span>
        <ChevronDownIcon
          class="comment-hidden__chevron"
          :class="{ 'comment-hidden__chevron--up': expanded }"
          :size="14"
          aria-hidden="true"
        />
      </button>
    </div>
    <div
      class="comment-hidden__fold"
      :class="{ 'comment-hidden__fold--open': expanded }"
      :inert="!expanded"
    >
      <div class="comment-hidden__fold-inner">
        <slot v-if="revealed" :body="state.body ?? body" />
      </div>
    </div>
  </div>
  <slot v-else :body="state.body ?? body" />
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

// The notice replaces the body on every surface, so it keeps one presentation
// instead of copying whichever body block it stands in for: a quiet line under
// the header, and the revealed body brings that surface's own spacing with it.
.comment-hidden {
  margin-top: 0.625rem;
}

.comment-hidden__notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.comment-hidden__state {
  min-width: 0;
  gap: 0.3rem;
  max-width: 100%;
  height: 1.5rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
}

.comment-hidden__icon {
  flex: none;
  color: var(--gitpulse-warning);
}

.comment-hidden__label {
  color: var(--gitpulse-text-strong);
  font-weight: 650;
}

.comment-hidden__divider {
  width: 1px;
  height: 0.75rem;
  flex: none;
  background: color-mix(in srgb, var(--gitpulse-text-muted) 40%, transparent);
}

.comment-hidden__reason {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--gitpulse-text-muted);
}

// A plain text control: the label is the affordance, so the toggle paints no box
// in either state and only brightens its text under the pointer.
.comment-hidden__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.16s ease;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-text-strong);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.comment-hidden__chevron {
  flex: none;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.comment-hidden__chevron--up {
  transform: rotate(180deg);
}

.comment-hidden__fold {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

.comment-hidden__fold--open {
  grid-template-rows: 1fr;
  margin-top: 0.25rem;
}

.comment-hidden__fold-inner {
  min-height: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .comment-hidden__toggle,
  .comment-hidden__chevron,
  .comment-hidden__fold {
    transition: none;
  }
}
</style>
