<template>
  <div class="quick-actions">
    <div class="buttons">
      <button
        v-if="currentTab === 'notifications'"
        class="button is-primary is-fullwidth"
        @click="$emit('action-click', 'mark-all-read')"
      >
        {{ t('dashboard.widgets.actions.markAllRead') }}
      </button>
      <button
        v-else-if="currentTab === 'issues'"
        class="button is-primary is-fullwidth"
        @click="$emit('action-click', 'create-issue')"
      >
        {{ t('dashboard.widgets.actions.createIssue') }}
      </button>
      <button
        v-else-if="currentTab === 'pulls'"
        class="button is-primary is-fullwidth"
        @click="$emit('action-click', 'create-pr')"
      >
        {{ t('dashboard.widgets.actions.createPr') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();

defineProps<{
  currentTab: string;
}>();

defineEmits<{
  'action-click': [action: string];
}>();
</script>

<style scoped lang="scss">
.quick-actions {
  .buttons {
    width: 100%;

    .button {
      margin-bottom: 0.5rem;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>
