<template>
  <div class="modal" :class="{ 'is-active': isVisible }">
    <div class="modal-background" @click="$emit('close')"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ t('issueDetail.lockIssueReason') }}</p>
        <button
          class="delete"
          @click="$emit('close')"
          aria-label="close"
          :disabled="loading"
        ></button>
      </header>
      <section class="modal-card-body">
        <p class="is-size-7 has-text-grey mb-4">
          {{ t('issueDetail.selectLockReason') }}
        </p>
        <div class="space-y-3">
          <div
            v-for="reason in lockReasons"
            :key="reason.value"
            class="lock-reason-item is-flex is-align-items-center p-3 rounded cursor-pointer"
            :class="{ 'is-selected': selectedReason === reason.value }"
            @click="selectedReason = reason.value"
          >
            <div class="mr-4">
              <input
                type="radio"
                :id="`lock-reason-${reason.value}`"
                name="lock-reason"
                :value="reason.value"
                v-model="selectedReason"
                style="width: 16px; height: 16px"
                @click.stop
              />
            </div>

            <div class="is-flex-grow-1">
              <div class="is-size-6 has-text-weight-medium">
                {{ reason.label }}
              </div>
              <div class="is-size-7 has-text-grey">
                {{ reason.description }}
              </div>
            </div>
          </div>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button class="button is-light" @click="$emit('close')" :disabled="loading">
          {{ t('issueDetail.cancel') }}
        </button>
        <button
          class="button is-primary ml-4"
          @click="confirmLock"
          :disabled="!selectedReason || loading"
        >
          <span v-if="loading" class="is-flex is-align-items-center">
            <LoadingIcon class="mr-2" :size="14" />
            {{ t('issueDetail.locking') }}
          </span>
          <span v-else>{{ t('issueDetail.lockIssue') }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import LoadingIcon from '~/components/ui/LoadingIcon.vue';

defineProps<{
  isVisible: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', lockReason: string): void;
}>();

const { t } = useI18n();
const selectedReason = shallowRef<string>('');

// Lock reasons for selection
const lockReasons = [
  {
    value: 'off-topic',
    label: t('issueDetail.lockReasonOffTopic'),
    description: t('issueDetail.lockReasonOffTopicDesc'),
  },
  {
    value: 'too heated',
    label: t('issueDetail.lockReasonTooHeated'),
    description: t('issueDetail.lockReasonTooHeatedDesc'),
  },
  {
    value: 'resolved',
    label: t('issueDetail.lockReasonResolved'),
    description: t('issueDetail.lockReasonResolvedDesc'),
  },
  {
    value: 'spam',
    label: t('issueDetail.lockReasonSpam'),
    description: t('issueDetail.lockReasonSpamDesc'),
  },
];

const confirmLock = () => {
  if (selectedReason.value) {
    emit('confirm', selectedReason.value);
    selectedReason.value = '';
  }
};
</script>

<style scoped lang="scss">
.lock-reason-item {
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    border-color: var(--gitpulse-border);
  }

  &.is-selected {
    background: var(--gitpulse-surface-active);
    border-color: var(--gitpulse-border-strong);
  }
}
</style>
