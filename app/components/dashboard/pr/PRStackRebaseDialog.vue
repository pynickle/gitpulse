<script setup lang="ts">
import { CheckIcon, CircleAlertIcon, GitBranchIcon, LoaderCircleIcon } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useId, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack } from '#shared/types/pulls';

const { owner, repo, stack } = defineProps<{
  owner: string;
  repo: string;
  stack: PullRequestStack;
}>();
const emit = defineEmits<{ close: []; settled: [] }>();
const { t } = useI18n();
const apiFetch = useGitPulseApiFetch();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton');
const titleId = useId();
const descriptionId = useId();
const layers = stack.layers;
const trunk = stack.trunk;
const stackNumber = stack.number;

type LayerResult = 'current' | 'rebased' | 'failed' | 'rebasing';
const results = shallowRef<Record<number, LayerResult>>({});
const phase = shallowRef<'ready' | 'running' | 'done'>('ready');
const error = shallowRef('');
let unmounted = false;

onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => {
  unmounted = true;
});

const close = () => {
  if (phase.value === 'running') return;
  dialog.value?.close();
  emit('close');
};

const cancel = (event: Event) => {
  event.preventDefault();
  close();
};

const label = (layer: (typeof layers)[number]) => {
  if (layer.state === 'closed' || layer.state === 'merged') {
    return t(`prReview.stackDetail.state.${layer.state}`);
  }
  return t(
    `prReview.stackRebase.${results.value[layer.number] ?? (phase.value === 'done' ? 'skipped' : 'pending')}`
  );
};

const setResult = (number: number, result: LayerResult) => {
  results.value = { ...results.value, [number]: result };
};

const confirm = async () => {
  if (phase.value !== 'ready') return;
  phase.value = 'running';
  for (const layer of layers) {
    if (unmounted) return;
    if (layer.state === 'merged' || layer.state === 'closed') continue;

    setResult(layer.number, 'rebasing');
    try {
      const { outcome } = await apiFetch<{ outcome: 'current' | 'rebased' }>(
        `/api/pulls/${owner}/${repo}/${layer.number}/stack-rebase`,
        {
          method: 'POST',
          body: {
            expectedHeadOid: layer.headSha,
            stackNumber,
            baseRef: layer.baseRef,
            baseSha: layer.baseSha,
            proof: layer.rebaseProof,
          },
        }
      );
      setResult(layer.number, outcome);
    } catch (cause: unknown) {
      setResult(layer.number, 'failed');
      error.value = getFetchErrorMessage(cause, t('prReview.stackRebase.failed'));
      break;
    }
  }
  if (unmounted) return;
  phase.value = 'done';
  emit('settled');
  await nextTick();
  closeButton.value?.focus();
};
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="stack-rebase"
      :aria-labelledby="titleId"
      :aria-describedby="descriptionId"
      @cancel="cancel"
    >
      <header class="stack-rebase__header">
        <GitBranchIcon :size="17" aria-hidden="true" />
        <h2 :id="titleId">{{ t('prReview.stackRebase.title') }}</h2>
      </header>
      <div class="stack-rebase__content">
        <p :id="descriptionId">{{ t('prReview.stackRebase.description', { trunk }) }}</p>
        <ol class="stack-rebase__layers">
          <li
            v-for="layer in layers"
            :key="layer.number"
            class="stack-rebase__layer"
            :data-result="results[layer.number]"
          >
            <span class="stack-rebase__pull">
              <span class="stack-rebase__number">#{{ layer.number }}</span>
              {{ layer.title }}
            </span>
            <span class="stack-rebase__result" role="status">
              <LoaderCircleIcon
                v-if="results[layer.number] === 'rebasing'"
                class="stack-rebase__spinner"
                :size="15"
                aria-hidden="true"
              />
              <CheckIcon
                v-else-if="
                  results[layer.number] === 'rebased' || results[layer.number] === 'current'
                "
                :size="15"
                aria-hidden="true"
              />
              <CircleAlertIcon
                v-else-if="results[layer.number] === 'failed'"
                :size="15"
                aria-hidden="true"
              />
              {{ label(layer) }}
            </span>
          </li>
        </ol>
        <p v-if="error" class="stack-rebase__error" role="alert">{{ error }}</p>
      </div>
      <footer class="stack-rebase__footer">
        <button
          ref="closeButton"
          type="button"
          class="button is-small"
          autofocus
          :disabled="phase === 'running'"
          @click="close"
        >
          {{ t(phase === 'done' ? 'prReview.stackDetail.close' : 'prReview.mergeBox.cancel') }}
        </button>
        <button
          v-if="phase === 'ready'"
          type="button"
          class="button is-small is-success"
          @click="confirm"
        >
          {{ t('prReview.stackRebase.confirm') }}
        </button>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped lang="scss">
.stack-rebase {
  width: min(36rem, calc(100% - 2rem));
  max-height: calc(100dvh - 2rem);
  padding: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
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
  overflow: hidden;
  overscroll-behavior: contain;
}

.stack-rebase__header,
.stack-rebase__footer {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
}

.stack-rebase__header {
  border-bottom: 1px solid var(--gitpulse-border);
  color: var(--gitpulse-text-strong);
  font-weight: 700;
}

.stack-rebase__content {
  overflow: auto;
  overscroll-behavior: contain;
  padding: 0.85rem 1rem;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.stack-rebase__layers {
  margin-top: 0.75rem;
  list-style: none;
}

.stack-rebase__layer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.55rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--gitpulse-border);
}

.stack-rebase__pull {
  flex: 1 1 14rem;
}

.stack-rebase__number,
.stack-rebase__result {
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.stack-rebase__number {
  margin-inline-end: 0.3rem;
}

.stack-rebase__result {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

[data-result='rebasing'] .stack-rebase__result {
  color: var(--gitpulse-info);
}

[data-result='rebased'] .stack-rebase__result,
[data-result='current'] .stack-rebase__result {
  color: var(--gitpulse-success-solid);
}

[data-result='failed'] .stack-rebase__result,
.stack-rebase__error {
  color: var(--gitpulse-danger-solid);
}

.stack-rebase__error {
  margin-top: 0.5rem;
}

.stack-rebase__footer {
  justify-content: flex-end;
  border-top: 1px solid var(--gitpulse-border);
}

@media (prefers-reduced-motion: no-preference) {
  .stack-rebase__spinner {
    animation: stack-rebase-spin 0.85s linear infinite;
  }
}

@keyframes stack-rebase-spin {
  to {
    transform: rotate(1turn);
  }
}
</style>
