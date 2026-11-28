<script setup lang="ts">
import {
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  LoaderCircleIcon,
  MinusIcon,
  XIcon,
} from '@lucide/vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useId,
  useTemplateRef,
} from 'vue';
import { useI18n } from 'vue-i18n';

import type {
  PullRequestStack,
  PullRequestStackLayerState,
  StackRebaseLayerOutcome,
  StackRebaseResult,
} from '#shared/types/pulls';

const { owner, repo, pullNumber, stack } = defineProps<{
  owner: string;
  repo: string;
  pullNumber: number;
  stack: PullRequestStack;
}>();
const emit = defineEmits<{
  close: [];
  settled: [result: { ok: boolean; error?: string }];
}>();
const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton');
const titleId = useId();
const descriptionId = useId();
// Frozen on open so background refreshes cannot shift layers mid-rebase.
const layers = stack.layers;
const trunk = stack.trunk;
const stackNumber = stack.number;

type LayerDisplayState = StackRebaseLayerOutcome | 'pending' | 'rebasing';

const isTerminalLayerState = (state: PullRequestStackLayerState): state is 'merged' | 'closed' =>
  state === 'merged' || state === 'closed';

const results = shallowRef<Partial<Record<number, LayerDisplayState>>>({});
const phase = shallowRef<'ready' | 'running' | 'done'>('ready');
const error = shallowRef('');
let unmounted = false;
let closed = false;

const emitClose = () => {
  if (closed || unmounted) return;
  closed = true;
  emit('close');
};

onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => {
  unmounted = true;
  dialog.value?.close();
});

const close = () => {
  if (phase.value === 'running') return;
  dialog.value?.close();
  emitClose();
};

const handleNativeClose = () => {
  if (phase.value === 'running') return;
  emitClose();
};

const cancel = (event: Event) => {
  event.preventDefault();
  close();
};

let pressedOutside = false;

const isOutsideDialog = (event: PointerEvent) => {
  const el = dialog.value;
  if (!el || Reflect.has(el, 'closedBy')) return false;
  const { left, right, top, bottom } = el.getBoundingClientRect();
  return (
    event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
  );
};

const handlePointerDown = (event: PointerEvent) => {
  pressedOutside = phase.value !== 'running' && isOutsideDialog(event);
};

const handlePointerUp = (event: PointerEvent) => {
  if (pressedOutside && phase.value !== 'running' && isOutsideDialog(event)) close();
  pressedOutside = false;
};

/** A Layer already landed has nothing to replay; the rest read their own progress. */
const layerResult = (layer: (typeof layers)[number]): LayerDisplayState => {
  if (isTerminalLayerState(layer.state)) return layer.state;
  return results.value[layer.number] ?? (phase.value === 'done' ? 'skipped' : 'pending');
};

const layerStatus = (layer: (typeof layers)[number]) => {
  const result = layerResult(layer);
  return result === 'merged' || result === 'closed'
    ? t(`prReview.stackDetail.state.${result}`)
    : t(`prReview.stackRebase.${result}`);
};

const STATUS_ICONS: Record<LayerDisplayState, typeof CheckIcon> = {
  merged: GitMergeIcon,
  closed: GitPullRequestClosedIcon,
  rebasing: LoaderCircleIcon,
  rebased: CheckIcon,
  current: CheckIcon,
  failed: CircleAlertIcon,
  skipped: MinusIcon,
  pending: ClockIcon,
};

const liveAnnouncement = computed(() => {
  if (phase.value === 'running') return t('prReview.stackRebase.liveRunning');
  if (phase.value === 'done') return error.value || t('prReview.stackRebase.liveDone');
  return '';
});

const confirm = async () => {
  if (phase.value !== 'ready') return;
  phase.value = 'running';
  error.value = '';

  const expectedHeads: Record<string, string> = {};
  const initialResults: Partial<Record<number, LayerDisplayState>> = {};
  for (const layer of layers) {
    if (isTerminalLayerState(layer.state)) continue;
    initialResults[layer.number] = 'rebasing';
    if (layer.headSha) {
      expectedHeads[String(layer.number)] = layer.headSha;
    }
  }
  results.value = initialResults;

  let settledOk = false;
  try {
    const response = await apiFetch<StackRebaseResult>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/stack-rebase`,
      {
        method: 'POST',
        body: {
          stackNumber,
          expectedHeads,
        },
      }
    );
    if (unmounted) return;

    const nextResults: Partial<Record<number, LayerDisplayState>> = {};
    for (const item of response.results ?? []) {
      nextResults[item.number] = item.outcome;
    }
    results.value = nextResults;
    settledOk = Boolean(response.ok);
    if (!response.ok) {
      const layerMessage = response.results?.find(
        (item) => item.outcome === 'failed' && item.message
      )?.message;
      error.value = response.error || layerMessage || t('prReview.stackRebase.failed');
    } else if (response.error) {
      error.value = response.error;
    }
  } catch (cause: unknown) {
    if (unmounted) return;
    const failedResults: Partial<Record<number, LayerDisplayState>> = {};
    for (const layer of layers) {
      if (isTerminalLayerState(layer.state)) continue;
      failedResults[layer.number] = 'failed';
    }
    results.value = failedResults;
    error.value = getFetchErrorMessage(cause, t('prReview.stackRebase.failed'));
    settledOk = false;
  }

  if (unmounted) return;
  phase.value = 'done';
  emit('settled', {
    ok: settledOk,
    ...(error.value ? { error: error.value } : {}),
  });
  await nextTick();
  if (unmounted) return;
  closeButton.value?.focus();
};
</script>

<template>
  <dialog
    ref="dialog"
    class="stack-rebase"
    :closedby="phase === 'running' ? 'none' : 'any'"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    @close="handleNativeClose"
    @cancel="cancel"
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
  >
    <header class="stack-rebase__header">
      <h2 :id="titleId" class="stack-rebase__title">
        <GitBranchIcon :size="15" aria-hidden="true" />
        {{ t('prReview.stackRebase.title') }}
      </h2>
      <button
        type="button"
        class="stack-rebase__close"
        :disabled="phase === 'running'"
        :aria-label="t('prReview.stackDetail.close')"
        @click="close"
      >
        <XIcon :size="16" aria-hidden="true" />
      </button>
    </header>

    <div class="stack-rebase__content">
      <p :id="descriptionId" class="stack-rebase__description">
        {{ t('prReview.stackRebase.description', { trunk }) }}
      </p>
      <p class="sr-only" role="status" aria-live="polite">
        {{ liveAnnouncement }}
      </p>
      <ol class="stack-rebase__layers">
        <li
          v-for="layer in layers"
          :key="layer.number"
          class="stack-rebase__layer"
          :data-state="layerResult(layer)"
        >
          <span class="stack-rebase__number">#{{ layer.number }}</span>
          <span class="stack-rebase__name">{{ layer.title }}</span>
          <span class="stack-rebase__status">
            <component :is="STATUS_ICONS[layerResult(layer)]" :size="14" aria-hidden="true" />
            {{ layerStatus(layer) }}
          </span>
        </li>
      </ol>
      <p v-if="error" class="stack-rebase__error" role="alert">
        <CircleAlertIcon :size="14" aria-hidden="true" />
        <span>{{ error }}</span>
      </p>
    </div>

    <footer class="stack-rebase__footer">
      <button
        ref="closeButton"
        type="button"
        class="stack-rebase__btn"
        :disabled="phase === 'running'"
        @click="close"
      >
        {{ t(phase === 'done' ? 'prReview.stackDetail.close' : 'prReview.mergeBox.cancel') }}
      </button>
      <button
        v-if="phase === 'ready'"
        type="button"
        class="stack-rebase__btn stack-rebase__btn--primary"
        @click="confirm"
      >
        {{ t('prReview.stackRebase.confirm') }}
      </button>
    </footer>
  </dialog>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.stack-rebase {
  margin: auto;
  width: min(38rem, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  box-shadow: var(--gitpulse-shadow-raised);
  overflow: hidden;
  overscroll-behavior: contain;
}

.stack-rebase[open] {
  display: flex;
  flex-direction: column;
}

.stack-rebase::backdrop {
  background: var(--gitpulse-overlay-bg);
  backdrop-filter: blur(6px);
  overflow: hidden;
  overscroll-behavior: contain;
}

/* ── Header ── */
.stack-rebase__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 10px;
}

.stack-rebase__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--gitpulse-text-strong);

  svg {
    flex-shrink: 0;
    color: var(--gitpulse-text-muted);
  }
}

.stack-rebase__close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  color: var(--gitpulse-text-subtle);
  background: transparent;
  border: 0;
  border-radius: var(--gitpulse-radius-md);
  cursor: pointer;
  transition:
    color 0.12s ease,
    background-color 0.12s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      color: var(--gitpulse-text);
      background: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* ── Content ── */
.stack-rebase__content {
  overflow: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding: 0 20px 16px;
}

.stack-rebase__description {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--gitpulse-text-muted);
}

.stack-rebase__layers {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  overflow: hidden;
}

.stack-rebase__layer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;

  & + & {
    border-top: 1px solid var(--gitpulse-border);
  }
}

.stack-rebase__number {
  flex-shrink: 0;
  font-family: var(--gitpulse-code-font-family);
  font-size: 11px;
  color: var(--gitpulse-text-subtle);
}

.stack-rebase__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
}

.stack-rebase__status {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
}

.stack-rebase__layer[data-state='rebasing'] .stack-rebase__status {
  color: var(--gitpulse-info);
}

.stack-rebase__layer[data-state='rebased'] .stack-rebase__status,
.stack-rebase__layer[data-state='current'] .stack-rebase__status {
  color: var(--gitpulse-success-solid);
}

.stack-rebase__layer[data-state='failed'] .stack-rebase__status {
  color: var(--gitpulse-danger-solid);
}

.stack-rebase__layer[data-state='merged'] .stack-rebase__status,
.stack-rebase__layer[data-state='closed'] .stack-rebase__status {
  color: var(--gitpulse-text-subtle);
}

.stack-rebase__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--gitpulse-danger-solid);
  background: var(--gitpulse-danger-soft);
  border-radius: var(--gitpulse-radius-lg);

  svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
}

/* ── Footer ── */
.stack-rebase__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--gitpulse-border);
}

.stack-rebase__btn {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--gitpulse-text);
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-md);
  cursor: pointer;
  transition:
    color 0.12s ease,
    background-color 0.12s ease,
    border-color 0.12s ease;

  @include hover-only {
    &:hover:not(:disabled) {
      color: var(--gitpulse-text-strong);
      background: var(--gitpulse-surface-hover);
      border-color: var(--gitpulse-border-strong);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &--primary {
    color: #ffffff;
    background: var(--gitpulse-primary-solid);
    border-color: var(--gitpulse-primary-solid);

    @include hover-only {
      &:hover:not(:disabled) {
        color: #ffffff;
        background: var(--gitpulse-primary-solid-hover);
        border-color: var(--gitpulse-primary-solid-hover);
      }
    }

    &:focus-visible,
    &:active:not(:disabled) {
      color: #ffffff;
      background: var(--gitpulse-primary-solid-hover);
      border-color: var(--gitpulse-primary-solid-hover);
    }
  }
}

@media (prefers-reduced-motion: no-preference) {
  .stack-rebase__layer[data-state='rebasing'] .stack-rebase__status svg {
    animation: stack-rebase-spin 0.85s linear infinite;
  }
}

@keyframes stack-rebase-spin {
  to {
    transform: rotate(1turn);
  }
}
</style>
