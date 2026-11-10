<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CommentModeration } from '#shared/types/comment-moderation';
import { useCommentModeration } from '~/composables/useCommentModeration';

const { target } = defineProps<{ target?: CommentModeration; body?: string }>();
const { t } = useI18n();
const { stateFor } = useCommentModeration();
const state = computed(() => stateFor(target));
const expanded = shallowRef(false);
watch(
  () => [
    target?.nodeId,
    state.value.moderation?.isMinimized,
    state.value.moderation?.minimizedReason,
  ],
  () => {
    expanded.value = false;
  }
);
const reason = computed(() =>
  state.value.moderation?.minimizedReason?.toUpperCase().replaceAll('-', '_')
);
</script>

<template>
  <div v-if="state.moderation?.isMinimized && !expanded" class="comment-hidden">
    <span>{{
      reason ? t(`commentModeration.reasons.${reason}`) : t('commentModeration.hidden')
    }}</span>
    <button type="button" class="button is-ghost is-small" @click="expanded = true">
      {{ t('commentModeration.expand') }}
    </button>
  </div>
  <slot v-else :body="state.body ?? body" />
</template>

<style scoped lang="scss">
.comment-hidden {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  color: var(--gitpulse-text-muted);
  font-size: 0.8125rem;
}
</style>
