<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  COMMENT_HIDDEN_REASONS,
  type CommentHiddenReason,
  type CommentModeration,
} from '#shared/types/comment-moderation';
import { useCommentModeration } from '~/composables/useCommentModeration';
import { useModalLifecycle } from '~/composables/useModalLifecycle';

const { target } = defineProps<{ target?: CommentModeration }>();
const { t } = useI18n();
const { stateFor, pendingFor, moderate } = useCommentModeration();
const current = computed(() => stateFor(target).moderation);
const pending = computed(() => pendingFor(target));
const available = computed(
  () =>
    current.value &&
    (current.value.viewerCanDelete ||
      (current.value.isMinimized
        ? current.value.viewerCanUnminimize
        : current.value.viewerCanMinimize))
);
const stage = shallowRef<'menu' | 'hide' | 'delete' | null>(null);
const reason = shallowRef<CommentHiddenReason | null>(null);
const error = shallowRef('');
const panel = ref<HTMLElement | null>(null);
const menuPosition = shallowRef({ top: '0px', left: '0px' });
const close = () => {
  if (!pending.value) stage.value = null;
};
const { handleKeydown } = useModalLifecycle({
  open: () => stage.value !== null,
  panel,
  onRequestClose: close,
});

const openMenu = (event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  menuPosition.value = {
    top: `${Math.min(rect.bottom + 4, window.innerHeight - 160)}px`,
    left: `${Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188))}px`,
  };
  error.value = '';
  stage.value = 'menu';
};
watch(stage, async (value) => {
  reason.value = null;
  await nextTick();
  if (value) panel.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
});
const submit = async (action: 'hide' | 'unhide' | 'delete') => {
  if (!current.value || pending.value || (action === 'hide' && !reason.value)) return;
  error.value = '';
  try {
    if (await moderate(current.value, action, reason.value ?? undefined)) stage.value = null;
  } catch (cause) {
    error.value = getFetchErrorMessage(cause, t('commentModeration.failed'));
  }
};
const onKeydown = (event: KeyboardEvent) => {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    const buttons = [
      ...(panel.value?.querySelectorAll<HTMLButtonElement>(
        stage.value === 'menu' ? '[role="menuitem"]' : '[role="radio"]'
      ) ?? []),
    ];
    if (buttons.length) {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }
  handleKeydown(event);
};
</script>

<template>
  <span v-if="available || stage" class="comment-actions">
    <button
      v-if="available"
      class="comment-actions__trigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="stage === 'menu'"
      :aria-label="t('commentModeration.actions')"
      :disabled="pending"
      @click="openMenu"
    >
      ⋯
    </button>
    <Teleport to="body">
      <div
        v-if="stage"
        class="reviewer-modal-overlay comment-actions__overlay"
        :class="{ 'comment-actions__overlay--menu': stage === 'menu' }"
        @click.self="close"
        @keydown="onKeydown"
      >
        <div
          ref="panel"
          class="reviewer-modal-panel comment-actions__panel"
          :class="{ 'comment-actions__menu': stage === 'menu' }"
          :style="stage === 'menu' ? menuPosition : undefined"
          :role="stage === 'menu' ? 'menu' : 'dialog'"
          :aria-modal="stage === 'menu' ? undefined : true"
          :aria-label="
            t(
              stage === 'hide'
                ? 'commentModeration.hide'
                : stage === 'delete'
                  ? current?.resourceType === 'PullRequestReview'
                    ? 'commentModeration.deleteReview'
                    : 'commentModeration.deleteComment'
                  : 'commentModeration.actions'
            )
          "
        >
          <template v-if="stage === 'menu'">
            <button
              v-if="!current?.isMinimized && current?.viewerCanMinimize"
              role="menuitem"
              type="button"
              class="comment-actions__option"
              :disabled="pending"
              @click="stage = 'hide'"
            >
              {{ t('commentModeration.hide') }}
            </button>
            <button
              v-if="current?.isMinimized && current?.viewerCanUnminimize"
              role="menuitem"
              type="button"
              class="comment-actions__option"
              :disabled="pending"
              @click="submit('unhide')"
            >
              {{ t('commentModeration.unhide') }}
            </button>
            <button
              v-if="current?.viewerCanDelete"
              role="menuitem"
              type="button"
              class="comment-actions__option has-text-danger"
              :disabled="pending"
              @click="stage = 'delete'"
            >
              {{ t('commentModeration.delete') }}
            </button>
          </template>
          <template v-else>
            <div class="reviewer-modal-header">
              <h3 class="reviewer-modal-title">
                {{
                  t(
                    stage === 'hide'
                      ? 'commentModeration.hide'
                      : current?.resourceType === 'PullRequestReview'
                        ? 'commentModeration.deleteReview'
                        : 'commentModeration.deleteComment'
                  )
                }}
              </h3>
            </div>
            <div
              v-if="stage === 'hide'"
              class="reviewer-modal-content comment-actions__reasons"
              role="radiogroup"
              :aria-label="t('commentModeration.reason')"
            >
              <button
                v-for="value in COMMENT_HIDDEN_REASONS"
                :key="value"
                role="radio"
                type="button"
                class="comment-actions__option"
                :aria-checked="reason === value"
                :disabled="pending"
                @click="reason = value"
              >
                {{ t(`commentModeration.reasons.${value}`) }}
              </button>
            </div>
            <footer class="reviewer-modal-footer">
              <button
                type="button"
                class="button is-small is-light"
                :disabled="pending"
                @click="close"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                class="button is-small"
                :class="stage === 'delete' ? 'is-danger' : 'is-link'"
                :disabled="pending || (stage === 'hide' && !reason)"
                @click="submit(stage === 'hide' ? 'hide' : 'delete')"
              >
                {{ t(stage === 'hide' ? 'commentModeration.hide' : 'commentModeration.delete') }}
              </button>
            </footer>
          </template>
          <p v-if="error" role="alert" class="notification is-danger is-light m-3 p-2 is-size-7">
            {{ error }}
          </p>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<style scoped lang="scss">
@use '~/assets/scss/reviewer-modal';
@use '~/assets/scss/pointer' as *;
.comment-actions {
  margin-left: auto;
  flex: none;
}
.comment-actions__trigger {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 1.25rem;
  cursor: pointer;
}
.comment-actions__panel {
  height: auto;
  max-height: calc(100dvh - 32px);
}
.comment-actions__reasons {
  overflow-y: auto;
  padding-top: 8px;
}
.comment-actions__option {
  display: block;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.comment-actions__option[aria-checked='true'] {
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
}
.comment-actions__trigger,
.comment-actions__option {
  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-surface-hover);
    }
  }
  &:focus-visible {
    outline: 2px solid var(--gitpulse-accent);
    outline-offset: 2px;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
.comment-actions__overlay--menu {
  background: transparent;
  backdrop-filter: none;
}
.comment-actions__menu {
  position: fixed;
  width: 180px;
  padding: 4px;
}
@media (max-width: 768px) {
  .comment-actions__overlay--menu {
    background: var(--gitpulse-overlay-bg);
    backdrop-filter: blur(6px);
  }
  .comment-actions__menu {
    top: auto !important;
    left: 12px !important;
    right: 12px;
    bottom: 12px;
    width: auto;
  }
  .comment-actions__panel {
    max-width: calc(100vw - 24px);
  }
}
</style>
