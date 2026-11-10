<script setup lang="ts">
import {
  CheckIcon,
  CircleExclamationPointIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  Trash2Icon,
  XIcon,
} from '@lucide/vue';
import { computed, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
  COMMENT_HIDDEN_REASONS,
  type CommentHiddenReason,
  type CommentModeration,
} from '#shared/types/comment-moderation';
import ScrollArea from '~/components/ui/ScrollArea.vue';
import { useCommentModeration } from '~/composables/useCommentModeration';
import { useModalLifecycle } from '~/composables/useModalLifecycle';

type Stage = 'menu' | 'hide' | 'delete';

// One hue per classifier, so the list reads as seven distinct choices: a
// moderation reason is never mistaken for its neighbour.
const REASON_COLORS: Record<CommentHiddenReason, string> = {
  ABUSE: 'var(--gitpulse-danger)',
  DUPLICATE: 'var(--gitpulse-info)',
  LOW_QUALITY: 'var(--gitpulse-warning)',
  OFF_TOPIC: 'var(--gitpulse-purple)',
  OUTDATED: 'var(--gitpulse-text-subtle)',
  RESOLVED: 'var(--gitpulse-success)',
  SPAM: 'color-mix(in srgb, var(--gitpulse-danger) 55%, var(--gitpulse-warning))',
};

const { target } = defineProps<{ target?: CommentModeration }>();
const { t } = useI18n();
const { stateFor, pendingFor, moderate } = useCommentModeration();
const current = computed(() => stateFor(target).moderation);
const pending = computed(() => pendingFor(target));
const canHide = computed(() =>
  Boolean(current.value && !current.value.isMinimized && current.value.viewerCanMinimize)
);
const canUnhide = computed(() =>
  Boolean(current.value?.isMinimized && current.value.viewerCanUnminimize)
);
const canDelete = computed(() => current.value?.viewerCanDelete === true);
const available = computed(() => canHide.value || canUnhide.value || canDelete.value);
// Radios group by name; one name per comment keeps two open pickers from sharing a
// single selection group.
const radioGroupName = computed(
  () => `comment-hidden-reason-${current.value?.nodeId ?? 'unknown'}`
);

const stage = shallowRef<Stage | null>(null);
const deleteLabel = computed(() =>
  current.value?.resourceType === 'PullRequestReview'
    ? t('commentModeration.deleteReview')
    : t('commentModeration.deleteComment')
);
const label = computed(() =>
  stage.value === 'hide'
    ? t('commentModeration.hide')
    : stage.value === 'delete'
      ? deleteLabel.value
      : t('commentModeration.actions')
);
const reason = shallowRef<CommentHiddenReason | null>(null);
const error = shallowRef('');
const panel = ref<HTMLElement | null>(null);
const dialogPanel = ref<HTMLElement | null>(null);
const menuPosition = shallowRef({ top: 0, bottom: 0, right: 8, space: 320 });
const flipped = shallowRef(false);
const close = () => {
  if (!pending.value) stage.value = null;
};
const { handleKeydown } = useModalLifecycle({
  open: () => stage.value !== null,
  panel,
  onRequestClose: close,
  // The menu and its dialogs take focus, not the page: the floating composer
  // under them stays where the reader left it.
  modal: false,
});

const chooseHide = () => {
  // Every visit to the reason picker starts without a choice.
  reason.value = null;
  stage.value = 'hide';
};

const openMenu = (event: MouseEvent) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  // The reason list is the tallest stage, so the menu turns upward rather than
  // opening a sliver at the bottom of the viewport.
  flipped.value = spaceBelow < 300 && rect.top > spaceBelow;
  menuPosition.value = {
    top: Math.round(rect.bottom + 6),
    bottom: Math.round(window.innerHeight - rect.top + 6),
    right: Math.round(Math.max(8, window.innerWidth - rect.right)),
    space: Math.round(Math.max(160, flipped.value ? rect.top - 12 : spaceBelow)),
  };
  error.value = '';
  stage.value = 'menu';
};
// The modal lifecycle focuses the menu when it opens; this watches the step that
// replaces it, whose element the lifecycle never sees.
watch(dialogPanel, (dialog) => {
  if (!dialog) return;
  const first =
    dialog.querySelector<HTMLElement>('input[type="radio"]:not(:disabled)') ??
    dialog.querySelector<HTMLElement>('.label-btn-cancel') ??
    dialog.querySelector<HTMLElement>('button:not(:disabled)');
  first?.focus();
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
  // The menu is the one roving list here; the reason picker is native radios, which
  // the browser already cycles with the arrow keys.
  if (stage.value === 'menu' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    const items = [
      ...(panel.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
    ];
    if (items.length) {
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
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
      :aria-expanded="stage !== null"
      :aria-label="t('commentModeration.actions')"
      :disabled="pending"
      @click="openMenu"
    >
      <LoaderCircleIcon v-if="pending" class="spin-animation" :size="15" aria-hidden="true" />
      <EllipsisIcon v-else :size="15" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <Transition name="label-modal">
        <div
          v-if="stage"
          ref="panel"
          class="label-editor-overlay comment-actions__overlay"
          :class="{ 'comment-actions__overlay--menu': stage === 'menu' }"
          @click.self="close"
          @keydown="onKeydown"
        >
          <Transition name="label-modal" mode="out-in">
            <div
              v-if="stage === 'menu'"
              key="menu"
              class="comment-actions__menu"
              :class="{ 'comment-actions__menu--flipped': flipped }"
              role="menu"
              :aria-label="t('commentModeration.actions')"
              :style="{
                '--comment-actions-top': `${menuPosition.top}px`,
                '--comment-actions-bottom': `${menuPosition.bottom}px`,
                '--comment-actions-right': `${menuPosition.right}px`,
                '--comment-actions-space': `${menuPosition.space}px`,
              }"
            >
              <button
                v-if="canHide"
                role="menuitem"
                type="button"
                class="comment-actions__item"
                :disabled="pending"
                @click="chooseHide"
              >
                <EyeOffIcon :size="15" aria-hidden="true" />
                <span>{{ t('commentModeration.hide') }}</span>
              </button>
              <button
                v-if="canUnhide"
                role="menuitem"
                type="button"
                class="comment-actions__item"
                :disabled="pending"
                @click="submit('unhide')"
              >
                <EyeIcon :size="15" aria-hidden="true" />
                <span>{{ t('commentModeration.unhide') }}</span>
              </button>
              <span
                v-if="canDelete && (canHide || canUnhide)"
                class="comment-actions__separator"
                aria-hidden="true"
              />
              <button
                v-if="canDelete"
                role="menuitem"
                type="button"
                class="comment-actions__item comment-actions__item--danger"
                :disabled="pending"
                @click="stage = 'delete'"
              >
                <Trash2Icon :size="15" aria-hidden="true" />
                <span>{{ t('commentModeration.delete') }}</span>
              </button>
              <div v-if="error" role="alert" class="comment-actions__error">
                <CircleExclamationPointIcon :size="14" aria-hidden="true" />
                <span>{{ error }}</span>
              </div>
            </div>

            <div
              v-else
              :key="stage"
              ref="dialogPanel"
              class="label-editor-panel"
              role="dialog"
              aria-modal="true"
              :aria-label="label"
            >
              <div class="label-editor-header">
                <h3 class="label-editor-title">{{ label }}</h3>
                <button
                  type="button"
                  class="label-editor-close"
                  :disabled="pending"
                  :aria-label="t('common.close')"
                  @click="close"
                >
                  <XIcon :size="16" aria-hidden="true" />
                </button>
              </div>
              <ScrollArea v-if="stage === 'hide'" class="label-editor-content">
                <div
                  class="label-editor-list"
                  role="radiogroup"
                  :aria-label="t('commentModeration.reason')"
                >
                  <label
                    v-for="value in COMMENT_HIDDEN_REASONS"
                    :key="value"
                    class="comment-actions__reason"
                    :class="{ 'comment-actions__reason--chosen': reason === value }"
                  >
                    <input
                      class="comment-actions__reason-input"
                      type="radio"
                      :name="radioGroupName"
                      :value="value"
                      :checked="reason === value"
                      :disabled="pending"
                      @change="reason = value"
                    />
                    <span
                      class="comment-actions__reason-bar"
                      :style="{ '--reason-color': REASON_COLORS[value] }"
                      aria-hidden="true"
                    />
                    <span class="comment-actions__reason-text">
                      <span class="comment-actions__reason-head">
                        <span class="comment-actions__reason-name">
                          {{ t(`commentModeration.reasons.${value}`) }}
                        </span>
                        <CheckIcon
                          class="comment-actions__reason-check"
                          :size="14"
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </label>
                </div>
              </ScrollArea>
              <div v-if="error" role="alert" class="label-editor-error comment-actions__error">
                <CircleExclamationPointIcon :size="14" aria-hidden="true" />
                <span>{{ error }}</span>
              </div>
              <div class="label-editor-footer">
                <button type="button" class="label-btn-cancel" :disabled="pending" @click="close">
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="button"
                  class="label-btn-save"
                  :class="{ 'comment-actions__submit--danger': stage === 'delete' }"
                  :disabled="pending || (stage === 'hide' && !reason)"
                  @click="submit(stage === 'hide' ? 'hide' : 'delete')"
                >
                  <LoaderCircleIcon v-if="pending" class="spin-animation" :size="14" />
                  <span>{{
                    t(stage === 'hide' ? 'commentModeration.hide' : 'commentModeration.delete')
                  }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped lang="scss">
@use '~/assets/scss/variables' as *;
@use '~/assets/scss/detail-metadata-editor';
@use '~/assets/scss/pointer' as *;

.comment-actions {
  display: inline-flex;
  flex: none;
  margin-left: auto;
}

// The trigger only answers a pointer that is on it: an open menu is marked by the
// menu itself, so the trigger keeps its resting tone once the pointer leaves.
.comment-actions__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--gitpulse-text-subtle);
  cursor: pointer;
  transition: all 0.12s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-accent-soft);
      color: var(--gitpulse-accent);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 1px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

// The anchored menu sits on a clear page; the dialogs keep the picker's scrim.
.comment-actions__overlay {
  transition:
    background-color 0.18s ease,
    backdrop-filter 0.18s ease;
}

.comment-actions__overlay--menu {
  background: transparent;
  backdrop-filter: none;
}

.comment-actions__menu {
  position: fixed;
  top: var(--comment-actions-top);
  right: var(--comment-actions-right);
  display: flex;
  flex-direction: column;
  width: min(200px, calc(100vw - 16px));
  max-height: min(60dvh, var(--comment-actions-space));
  padding: 4px;
  overflow-y: auto;
  border: 1px solid var(--gitpulse-border-strong);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface-raised);
  box-shadow: var(--gitpulse-shadow-raised);
  transform-origin: top right;
}

.comment-actions__menu--flipped {
  top: auto;
  bottom: var(--comment-actions-bottom);
  transform-origin: bottom right;
}

.comment-actions__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 2rem;
  padding: 0 0.55rem;
  border: 0;
  border-radius: var(--gitpulse-radius-md);
  background: transparent;
  color: var(--bulma-text, var(--gitpulse-text));
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: $theme-transition;

  svg {
    flex: none;
    color: var(--gitpulse-text-subtle);
  }

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-surface-active);
      color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    }
  }

  &:focus-visible {
    background: var(--gitpulse-surface-active);
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.comment-actions__item--danger,
.comment-actions__item--danger svg {
  color: var(--gitpulse-danger);
}

.comment-actions__separator {
  display: block;
  height: 1px;
  margin: 4px 6px;
  background: var(--gitpulse-border);
}

// One row per classifier, in the picker's own language: a colour bar for the
// reason, its name, and a check that appears once it is chosen.
.comment-actions__reason {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px 9px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-active);
    }
  }

  &:has(.comment-actions__reason-input:focus-visible) {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: -2px;
  }

  &:has(.comment-actions__reason-input:disabled) {
    cursor: progress;
    opacity: 0.6;
  }
}

.comment-actions__reason-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  clip-path: inset(50%);
  pointer-events: none;
}

.comment-actions__reason-bar {
  flex-shrink: 0;
  align-self: stretch;
  width: 3px;
  border-radius: 2px;
  background: var(--reason-color, var(--gitpulse-border-strong));
  opacity: 0.5;
  transition: opacity 0.12s ease;
}

.comment-actions__reason-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.comment-actions__reason-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.comment-actions__reason-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  transition: color 0.12s ease;
}

.comment-actions__reason-check {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
  opacity: 0;
  transform: scale(0.7);
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

// The chosen reason keeps its own tone even under the pointer, so the reader can
// still tell what the dialog is about to submit.
.comment-actions__reason--chosen {
  background: var(--gitpulse-accent-soft);

  .comment-actions__reason-bar {
    opacity: 1;
  }

  .comment-actions__reason-name {
    font-weight: 600;
    color: var(--gitpulse-accent);
  }

  .comment-actions__reason-check {
    opacity: 1;
    transform: scale(1);
  }
}

// The error rides with whichever step asked for it: the menu when an Unhide was
// refused, the picker or the confirmation when their own request was.
.comment-actions__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 20px 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--gitpulse-danger-soft);
  color: var(--gitpulse-danger);
  font-size: 12px;
}

.comment-actions__menu .comment-actions__error {
  margin: 4px 4px 2px;
}

// The delete answer is the one filled control that only removes: it keeps the
// picker's filled-button geometry, in the danger tone.
.comment-actions__submit--danger {
  color: var(--bulma-primary-invert, #fff);
  background: var(--gitpulse-danger-solid);

  @include hover-only {
    &:hover:not(:disabled) {
      background: var(--gitpulse-danger-solid-hover);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--gitpulse-danger-solid) 28%, transparent);
    }
  }

  // A filled surface keeps an answer to a press (ADR 0032).
  &:active:not(:disabled) {
    background: var(--gitpulse-danger-solid-hover);
  }
}

// The step inside the picker's overlay is that same `label-modal` transition: the
// menu and the panel alternate as its children, so the panel's own root carries
// the motion the shared stylesheet gives a nested `.label-editor-panel`.
.label-editor-panel.label-modal-enter-active {
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}

.label-editor-panel.label-modal-leave-active {
  transition:
    transform 0.12s ease,
    opacity 0.12s ease;
}

.label-editor-panel.label-modal-enter-from,
.label-editor-panel.label-modal-leave-to {
  opacity: 0;
  transform: scale(0.97) translateY(6px);
}

// The menu mounts inside the picker's overlay, so its own pop belongs to that
// transition rather than to a second one.
.label-modal-enter-active .comment-actions__menu,
.label-modal-leave-active .comment-actions__menu {
  transition:
    opacity 0.16s ease,
    transform 0.16s cubic-bezier(0.32, 0.72, 0, 1);
}

.label-modal-enter-from .comment-actions__menu,
.label-modal-leave-to .comment-actions__menu {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}

@media (max-width: 768px) {
  .comment-actions__menu {
    top: auto;
    right: 8px;
    bottom: 8px;
    left: 8px;
    width: auto;
    max-height: 70dvh;
    border-radius: var(--gitpulse-radius-xl);
    transform-origin: bottom center;
  }

  .comment-actions__overlay--menu {
    background: var(--gitpulse-overlay-bg);
    backdrop-filter: blur(4px);
  }

  .label-modal-enter-from .comment-actions__menu,
  .label-modal-leave-to .comment-actions__menu {
    transform: translate3d(0, 12px, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .comment-actions__trigger,
  .comment-actions__item,
  .comment-actions__reason,
  .comment-actions__reason-bar,
  .comment-actions__reason-name,
  .comment-actions__reason-check,
  .comment-actions__overlay,
  .label-modal-enter-active .comment-actions__menu,
  .label-modal-leave-active .comment-actions__menu,
  .label-editor-panel.label-modal-enter-active,
  .label-editor-panel.label-modal-leave-active {
    transition: none;
  }

  .label-modal-enter-from .comment-actions__menu,
  .label-editor-panel.label-modal-enter-from {
    transform: none;
  }
}
</style>
