<script setup lang="ts">
import { CircleCheckIcon, CircleDotIcon, CircleMinusIcon, ListTreeIcon } from '@lucide/vue';

import type { SubIssueIdentity, SubIssueRow } from '#shared/types/sub-issues';

defineProps<{ rows: SubIssueRow[] }>();
const emit = defineEmits<{ select: [identity: SubIssueIdentity] }>();
const { t } = useI18n();

const icons = {
  open: CircleDotIcon,
  completed: CircleCheckIcon,
  notPlanned: CircleMinusIcon,
  closed: CircleMinusIcon,
};
const select = ({ owner, repo, number }: SubIssueRow) => emit('select', { owner, repo, number });
</script>

<template>
  <ul v-if="rows.length" class="sub-issue-rows" data-picker-list>
    <li v-for="row in rows" :key="`${row.owner}/${row.repo}#${row.number}`">
      <button type="button" class="sub-issue-row" data-picker-row @click="select(row)">
        <component
          :is="icons[row.state]"
          :size="16"
          class="sub-issue-row__status"
          :class="`sub-issue-row__status--${row.state}`"
          role="img"
          :aria-label="t(`dashboard.subIssues.states.${row.state}`)"
        />
        <span class="sub-issue-row__title">
          <span class="sub-issue-row__reference">
            <template v-if="row.showRepository">{{ row.owner }}/{{ row.repo }}</template>#{{
              row.number
            }}
          </span>
          {{ row.title }}
        </span>
        <span
          v-if="row.subIssuesSummary"
          class="sub-issue-row__progress"
          :title="t('dashboard.subIssues.progress', { ...row.subIssuesSummary })"
        >
          <ListTreeIcon :size="13" aria-hidden="true" />
          <span>{{ row.subIssuesSummary.completed }}/{{ row.subIssuesSummary.total }}</span>
        </span>
      </button>
    </li>
  </ul>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.sub-issue-rows {
  margin: 0;
  padding: 0;
  list-style: none;

  li + li {
    border-top: 1px solid var(--gitpulse-border);
  }
}

.sub-issue-row {
  display: flex;
  width: 100%;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text);
  font: inherit;
  font-size: 0.875rem;
  text-align: start;
  cursor: pointer;

  @include hover-only {
    &:hover {
      background: var(--gitpulse-surface-hover);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: -2px;
  }
}

.sub-issue-row__status {
  flex: none;
  align-self: flex-start;
  margin-block-start: 0.125rem;
  color: var(--gitpulse-text-muted);
}

.sub-issue-row__status--open {
  color: var(--gitpulse-success);
}

.sub-issue-row__status--completed {
  color: var(--gitpulse-purple);
}

.sub-issue-row__title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.sub-issue-row__reference,
.sub-issue-row__progress {
  color: var(--gitpulse-text-muted);
}

.sub-issue-row__progress {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}
</style>
