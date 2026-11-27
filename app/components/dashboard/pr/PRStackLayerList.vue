<script setup lang="ts">
import {
  ChevronRightIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
} from '@lucide/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PullRequestStack, PullRequestStackLayerState } from '#shared/types/pulls';
import {
  findCurrentStackLayerIndex,
  hasMultiActiveStackDependencies,
  isActiveStackLayerState,
} from '#shared/utils/pr-stack';

const {
  stack,
  currentPullNumber,
  pickerMode = false,
} = defineProps<{
  stack: PullRequestStack;
  currentPullNumber?: number;
  /** Enables PickerModal keyboard navigation attributes (`data-picker-list` / `data-picker-row`). */
  pickerMode?: boolean;
}>();

const emit = defineEmits<{
  select: [pullNumber: number];
}>();

const { t } = useI18n();

const showHistoryBadge = computed(
  () =>
    hasMultiActiveStackDependencies(stack, currentPullNumber) &&
    (stack.history === 'linear' || stack.history === 'not-linear')
);

const historyLabel = computed(() =>
  stack.history === 'linear'
    ? t('prReview.stackDetail.historyLinear')
    : t('prReview.stackDetail.historyNeedsRebase')
);

const layers = computed(() => {
  const currentIndex = findCurrentStackLayerIndex(stack, currentPullNumber);
  return stack.layers.map((layer, index) => ({
    ...layer,
    index: index + 1,
    current: index === currentIndex,
    behindCount:
      isActiveStackLayerState(layer.state) &&
      typeof layer.behindBy === 'number' &&
      layer.behindBy > 0
        ? layer.behindBy
        : 0,
  }));
});

const stateIconFor = (state: PullRequestStackLayerState) => {
  switch (state) {
    case 'merged':
      return GitMergeIcon;
    case 'closed':
      return GitPullRequestClosedIcon;
    case 'draft':
      return GitPullRequestDraftIcon;
    default:
      return GitPullRequestIcon;
  }
};

const behindLabelFor = (count: number) =>
  count === 1
    ? t('prReview.stackDetail.behindOne')
    : t('prReview.stackDetail.behindMany', { count });
</script>

<template>
  <div class="pr-stack-detail">
    <div class="pr-stack-detail__trunk">
      <GitBranchIcon :size="15" class="pr-stack-detail__trunk-icon" aria-hidden="true" />
      <span class="pr-stack-detail__trunk-label">{{ t('prReview.stackDetail.trunk') }}</span>
      <code class="pr-stack-detail__trunk-branch">{{ stack.trunk }}</code>
      <span v-if="showHistoryBadge" class="pr-stack-detail__history" :data-history="stack.history">
        {{ historyLabel }}
      </span>
    </div>

    <ol
      v-if="layers.length"
      class="pr-stack-detail__layers"
      :data-picker-list="pickerMode ? '' : undefined"
    >
      <li v-for="layer in layers" :key="layer.number" class="pr-stack-detail__row">
        <span
          class="pr-stack-detail__node"
          :data-state="layer.state"
          :data-current="layer.current ? 'true' : undefined"
          aria-hidden="true"
        >
          <component :is="stateIconFor(layer.state)" :size="12" />
        </span>

        <component
          :is="layer.current ? 'div' : 'button'"
          :type="layer.current ? undefined : 'button'"
          class="pr-stack-detail__layer"
          :aria-current="layer.current ? 'true' : undefined"
          :data-picker-row="pickerMode && !layer.current ? '' : undefined"
          @click="!layer.current && emit('select', layer.number)"
        >
          <span class="pr-stack-detail__content">
            <span class="pr-stack-detail__title">{{ layer.title }}</span>{{ ' ' }}
            <span class="pr-stack-detail__meta">
              <span class="pr-stack-detail__index">{{
                t('prReview.stackDetail.layerIndex', { index: layer.index })
              }}</span
              >{{ ' ' }}<span class="pr-stack-detail__number">#{{ layer.number }}</span>{{ ' '
              }}<span class="pr-stack-detail__state" :data-state="layer.state">{{
                t(`prReview.stackDetail.state.${layer.state}`)
              }}</span>
              <template v-if="layer.current">
                {{ ' '
                }}<span class="pr-stack-detail__current">{{
                  t('prReview.stackDetail.current')
                }}</span>
              </template>
              <template v-if="layer.behindCount > 0">
                {{ ' '
                }}<span class="pr-stack-detail__behind">{{
                  behindLabelFor(layer.behindCount)
                }}</span>
              </template>
            </span>
          </span>
          <ChevronRightIcon
            v-if="!layer.current"
            :size="15"
            class="pr-stack-detail__chevron"
            aria-hidden="true"
          />
        </component>
      </li>
    </ol>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.pr-stack-detail__trunk {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.25rem 0.35rem 0.35rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
}

.pr-stack-detail__trunk-icon {
  flex: none;
  color: var(--gitpulse-text-muted);
}

.pr-stack-detail__trunk-label {
  font-weight: 500;
}

.pr-stack-detail__trunk-branch {
  padding: 0.08rem 0.42rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-strong, var(--gitpulse-text));
  font-family: var(--gitpulse-code-font-family);
  font-size: 0.72rem;
  overflow-wrap: anywhere;
}

.pr-stack-detail__history {
  margin-left: auto;
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;

  &[data-history='linear'] {
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  &[data-history='not-linear'] {
    background: var(--gitpulse-warning-soft);
    color: var(--gitpulse-warning);
  }
}

.pr-stack-detail__layers {
  margin: 0;
  padding: 0;
  list-style: none;
}

.pr-stack-detail__row {
  position: relative;
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.45rem;

  &::before {
    position: absolute;
    inset: 0 auto 0 0.875rem;
    width: 1px;
    background: var(--gitpulse-border-strong);
    content: '';
  }

  &:last-child::before {
    bottom: 50%;
  }
}

.pr-stack-detail__node {
  z-index: 0;
  display: grid;
  place-items: center;
  justify-self: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 50%;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-muted);

  &[data-state='open'] {
    border-color: color-mix(in srgb, var(--gitpulse-success) 40%, var(--gitpulse-border));
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  &[data-state='merged'] {
    border-color: color-mix(in srgb, var(--gitpulse-purple) 40%, var(--gitpulse-border));
    background: var(--gitpulse-purple-soft);
    color: var(--gitpulse-purple);
  }

  &[data-state='closed'] {
    border-color: color-mix(in srgb, var(--gitpulse-danger) 40%, var(--gitpulse-border));
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }

  &[data-state='draft'] {
    background: var(--gitpulse-surface-muted);
    color: var(--gitpulse-text-muted);
  }

  &[data-current='true'] {
    box-shadow: 0 0 0 2px var(--gitpulse-accent);
  }
}

.pr-stack-detail__layer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-sm, 8px);
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text);
  font: inherit;
  text-align: start;
}

.pr-stack-detail__content {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  flex: 1;
  min-width: 0;
}

.pr-stack-detail__title {
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong, var(--gitpulse-text)));
  overflow-wrap: anywhere;
}

.pr-stack-detail__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  font-size: 0.7rem;
  line-height: 1.25;
}

.pr-stack-detail__index {
  color: var(--gitpulse-text-muted);
  font-weight: 500;
}

.pr-stack-detail__number {
  font-family: var(--gitpulse-code-font-family);
  color: var(--gitpulse-text-subtle);
}

.pr-stack-detail__state,
.pr-stack-detail__current,
.pr-stack-detail__behind {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}

.pr-stack-detail__state {
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);

  &[data-state='open'] {
    background: var(--gitpulse-success-soft);
    color: var(--gitpulse-success);
  }

  &[data-state='merged'] {
    background: var(--gitpulse-purple-soft);
    color: var(--gitpulse-purple);
  }

  &[data-state='closed'] {
    background: var(--gitpulse-danger-soft);
    color: var(--gitpulse-danger);
  }

  &[data-state='draft'] {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-muted);
  }
}

.pr-stack-detail__current {
  background: var(--gitpulse-accent-soft);
  color: var(--gitpulse-accent);
}

.pr-stack-detail__behind {
  background: var(--gitpulse-warning-soft);
  color: var(--gitpulse-warning);
  font-variant-numeric: tabular-nums;
}

.pr-stack-detail__chevron {
  flex: none;
  color: var(--gitpulse-text-subtle);
}

.pr-stack-detail__layer[aria-current='true'] {
  border-color: var(--gitpulse-accent);
  background: var(--gitpulse-accent-soft);
}

button.pr-stack-detail__layer {
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
      border-color: var(--gitpulse-border-strong);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: -2px;
  }
}
</style>
