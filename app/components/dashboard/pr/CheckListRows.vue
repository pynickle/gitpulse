<script setup lang="ts">
import type { CheckListGroup } from '#shared/types/pr-checks';

defineProps<{
  groups: CheckListGroup[];
}>();

const { t } = useI18n();
</script>

<template>
  <div class="check-list">
    <template v-for="group in groups" :key="group.kind">
      <p class="check-list__group-label" :data-kind="group.kind">
        {{ t(`dashboard.checks.group_${group.kind}`) }}
        <span class="check-list__group-count">{{ group.checks.length }}</span>
      </p>
      <ul class="check-list__group">
        <li v-for="check in group.checks" :key="check.key" class="check-list__row">
          <span class="check-list__dot" :data-kind="group.kind" aria-hidden="true" />
          <a
            v-if="check.detailsUrl"
            :href="check.detailsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="check-list__name check-list__name--link"
          >
            {{ check.name }}
          </a>
          <span v-else class="check-list__name">{{ check.name }}</span>
          <span v-if="check.appName" class="check-list__app">{{ check.appName }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped lang="scss">
.check-list__group-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.85rem 0 0.3rem;
  color: var(--gitpulse-text-muted, #6b7280);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &:first-child {
    margin-top: 0.35rem;
  }
}

.check-list__group-count {
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-muted, rgba(0, 0, 0, 0.06));
  font-size: 0.68rem;
  font-weight: 600;
}

.check-list__group {
  margin: 0;
  padding: 0;
  list-style: none;
}

.check-list__row {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  padding: 0.18rem 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.check-list__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--gitpulse-text-muted, #6b7280);
}

.check-list__dot[data-kind='failure'] {
  background: var(--gitpulse-danger, #cf222e);
}

.check-list__dot[data-kind='pending'] {
  background: var(--gitpulse-warning, #bf8700);
}

.check-list__dot[data-kind='success'] {
  background: var(--gitpulse-success, #1a7f37);
}

.check-list__dot[data-kind='neutral'],
.check-list__dot[data-kind='skipped'] {
  background: var(--gitpulse-text-subtle, #9ca3af);
}

.check-list__name {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--gitpulse-text);
}

.check-list__name--link {
  color: var(--gitpulse-link, var(--gitpulse-text));
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.check-list__app {
  flex: none;
  margin-left: auto;
  padding-left: 0.5rem;
  color: var(--gitpulse-text-subtle, #9ca3af);
  font-size: 0.7rem;
  white-space: nowrap;
}
</style>
