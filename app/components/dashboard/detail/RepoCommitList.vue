<script setup lang="ts">
import {
  TriangleExclamationPointIcon,
  GitCommitHorizontalIcon,
  LoaderCircleIcon,
} from '@lucide/vue';

import type { RepoCommitListItemPayload } from '#shared/types/repos';
import CommitListRow from '~/components/dashboard/detail/CommitListRow.vue';
import Button from '~/components/ui/Button.vue';

defineProps<{
  items: RepoCommitListItemPayload[];
  loading: boolean;
  error: string;
  emptyMessage: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const { t } = useI18n();
</script>

<template>
  <section class="repo-commit-list" :aria-label="t('repoDetail.commits')">
    <div v-if="loading" class="repo-commit-list__loading" aria-busy="true">
      <LoaderCircleIcon :size="20" class="spin-animation" />
      <span>{{ t('repoDetail.loadingList') }}</span>
    </div>

    <div v-else-if="error" class="repo-commit-list__error" role="alert">
      <div class="repo-commit-list__error-icon" aria-hidden="true">
        <TriangleExclamationPointIcon :size="28" />
      </div>
      <p class="repo-commit-list__error-title">{{ t('repoDetail.listErrorTitle') }}</p>
      <p class="repo-commit-list__error-message">{{ error }}</p>
      <Button color="primary" size="normal" @click="emit('retry')">
        {{ t('repoDetail.retry') }}
      </Button>
    </div>

    <template v-else>
      <div v-if="items.length === 0" class="repo-commit-list__empty">
        <GitCommitHorizontalIcon :size="16" aria-hidden="true" />
        <span>{{ emptyMessage }}</span>
      </div>

      <ul v-else class="repo-commit-list__items">
        <li v-for="commit in items" :key="commit.sha" class="repo-commit-list__item">
          <CommitListRow :commit="commit" />
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped lang="scss">
.repo-commit-list {
  min-height: 8rem;
  min-width: 0;
  /* Match sticky chrome horizontal inset so left/right edges line up. */
  padding: 0.5rem 0.35rem 1rem;
}

.repo-commit-list__loading,
.repo-commit-list__empty,
.repo-commit-list__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.875rem;
  text-align: center;
}

.repo-commit-list__error-icon {
  color: var(--gitpulse-warning, #d97706);
}

.repo-commit-list__error-title {
  margin: 0;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.9375rem;
  font-weight: 600;
}

.repo-commit-list__error-message {
  margin: 0 0 0.5rem;
  max-width: 28rem;
}

.repo-commit-list__items {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--gitpulse-border);
  border-radius: 10px;
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.repo-commit-list__item + .repo-commit-list__item {
  border-top: 1px solid var(--gitpulse-border-subtle, var(--gitpulse-border));
}

.spin-animation {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
