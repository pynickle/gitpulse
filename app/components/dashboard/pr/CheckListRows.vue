<script setup lang="ts">
import {
  CircleCheckIcon,
  CircleMinusIcon,
  CircleSlashIcon,
  CircleXIcon,
  LoaderCircleIcon,
  WrenchIcon,
} from '@lucide/vue';
import { ref } from 'vue';

import type { CheckListGroup, CheckListItem, CheckOutcomeGroup } from '#shared/types/pr-checks';
import { formatCompactCheckDuration } from '#shared/utils/pr-checks';

defineProps<{
  groups: CheckListGroup[];
}>();

const { t, locale } = useI18n();
const relativeTimeNow = useRelativeTimeNow();
const failedLogoKeys = ref<Record<string, true>>({});

const onLogoError = (key: string) => {
  failedLogoKeys.value = { ...failedLogoKeys.value, [key]: true };
};

const statusIconFor = (kind: CheckOutcomeGroup) => {
  switch (kind) {
    case 'failure':
      return CircleXIcon;
    case 'pending':
      return LoaderCircleIcon;
    case 'success':
      return CircleCheckIcon;
    case 'neutral':
      return CircleMinusIcon;
    case 'skipped':
      return CircleSlashIcon;
  }
};

const distinctSummaryFor = (check: CheckListItem): string | null => {
  const summary = check.summary?.trim();
  if (!summary) return null;
  if (summary.toLowerCase() === check.name.trim().toLowerCase()) return null;
  return summary;
};

const QUEUED_STATUSES = new Set(['QUEUED', 'WAITING', 'REQUESTED']);

const statusPrefixFor = (kind: CheckOutcomeGroup, check: CheckListItem): string => {
  if (kind === 'pending') {
    const status = check.status?.trim().toUpperCase() ?? '';
    if (QUEUED_STATUSES.has(status)) {
      return t('dashboard.checks.statusQueued');
    }
    if (check.startedAt) {
      const start = Date.parse(check.startedAt);
      const now =
        typeof relativeTimeNow.value === 'number' && relativeTimeNow.value > 0
          ? relativeTimeNow.value
          : Date.now();
      if (Number.isFinite(start) && now > start) {
        const elapsed = formatCompactCheckDuration((now - start) / 1000, t);
        if (elapsed) {
          return t('dashboard.checks.statusInProgressFor', { duration: elapsed });
        }
      }
    }
    return t('dashboard.checks.statusInProgress');
  }

  const conclusion = check.conclusion?.trim().toUpperCase() ?? '';
  const keyBase =
    kind === 'success'
      ? 'statusSuccess'
      : kind === 'neutral'
        ? 'statusNeutral'
        : kind === 'skipped'
          ? 'statusSkipped'
          : conclusion === 'CANCELLED'
            ? 'statusCancelled'
            : conclusion === 'TIMED_OUT'
              ? 'statusTimedOut'
              : 'statusFailed';

  if (check.durationSeconds !== null && check.durationSeconds > 0) {
    const duration = formatCompactCheckDuration(check.durationSeconds, t);
    if (duration) {
      return t(`dashboard.checks.${keyBase}In`, { duration });
    }
  }

  const timestamp = check.completedAt ?? check.createdAt ?? check.startedAt;
  if (timestamp) {
    const relative = formatDurationFromNow(
      timestamp,
      locale.value,
      relativeTimeNow.value || undefined
    );
    if (relative) {
      return t(`dashboard.checks.${keyBase}At`, { time: relative });
    }
  }

  return t(`dashboard.checks.${keyBase}`);
};
</script>

<template>
  <div class="check-list">
    <template v-for="group in groups" :key="group.kind">
      <p class="check-list__group-label" :data-kind="group.kind">
        {{ t(`dashboard.checks.group_${group.kind}`) }}
        <span class="check-list__group-count">{{ group.checks.length }}</span>
      </p>
      <ul class="check-list__group">
        <li
          v-for="check in group.checks"
          :key="check.key"
          class="check-list__row"
          :class="{ 'check-list__row--detailed': Boolean(distinctSummaryFor(check)) }"
        >
          <span
            class="check-list__status-icon"
            :class="{ 'check-list__status-icon--spin': group.kind === 'pending' }"
            :data-kind="group.kind"
            aria-hidden="true"
          >
            <component :is="statusIconFor(group.kind)" :size="14" />
          </span>

          <span class="check-list__avatar" :title="check.appName ?? undefined" aria-hidden="true">
            <img
              v-if="check.appLogoUrl && !failedLogoKeys[check.key]"
              :src="check.appLogoUrl"
              :alt="check.appName ?? ''"
              :title="check.appName ?? undefined"
              class="check-list__avatar-img"
              width="16"
              height="16"
              loading="lazy"
              @error="onLogoError(check.key)"
            />
            <WrenchIcon v-else :size="11" class="check-list__avatar-fallback" />
          </span>

          <div class="check-list__body">
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

            <p class="check-list__meta">
              <span class="check-list__status-text">{{ statusPrefixFor(group.kind, check) }}</span>
              <template v-if="distinctSummaryFor(check)">
                <span class="check-list__summary-sep" aria-hidden="true"> — </span>
                <span class="check-list__summary">{{ distinctSummaryFor(check) }}</span>
              </template>
            </p>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '~/assets/scss/pointer' as *;

.check-list {
  container-type: inline-size;
}

.check-list__group-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 10px 0 4px;
  color: var(--gitpulse-text-muted, #6b7280);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &:first-child {
    margin-top: 8px;
  }
}

.check-list__group-count {
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-muted, rgba(0, 0, 0, 0.06));
  font-size: 0.66rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.check-list__group {
  margin: 0;
  padding: 0;
  list-style: none;
}

.check-list__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 28px;
  padding: 5px 0;
  font-size: 12px;
  line-height: 1.4;
}

.check-list__status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 16px;
  height: 18px;
  color: var(--gitpulse-text-muted, #6b7280);

  &[data-kind='failure'] {
    color: var(--gitpulse-danger, #cf222e);
  }

  &[data-kind='pending'] {
    color: var(--gitpulse-warning, #bf8700);
  }

  &[data-kind='success'] {
    color: var(--gitpulse-success, #1a7f37);
  }

  &[data-kind='neutral'],
  &[data-kind='skipped'] {
    color: var(--gitpulse-text-subtle, #9ca3af);
  }

  &--spin svg {
    animation: check-list-spin 1.1s linear infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .check-list__status-icon--spin svg {
    animation: none;
  }
}

@keyframes check-list-spin {
  to {
    transform: rotate(360deg);
  }
}

.check-list__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border-radius: 4px;
  background: var(--gitpulse-surface-hover, rgba(0, 0, 0, 0.05));
  color: var(--gitpulse-text-muted, #6b7280);
  overflow: hidden;
}

.check-list__avatar-img {
  display: block;
  width: 16px;
  height: 16px;
  object-fit: cover;
  border-radius: 4px;
}

.check-list__avatar-fallback {
  display: block;
}

.check-list__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.check-list__name {
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 500;
  color: var(--gitpulse-text-strong);
}

.check-list__name--link {
  color: var(--gitpulse-text-strong);
  text-decoration: none;
  transition: color 0.15s ease;

  @include hover-only {
    &:hover {
      color: var(--gitpulse-accent);
      text-decoration: underline;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring, var(--gitpulse-accent));
    outline-offset: 2px;
    border-radius: 3px;
  }
}

.check-list__meta {
  margin: 0;
  min-width: 0;
  color: var(--gitpulse-text-muted, #6b7280);
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.check-list__status-text {
  font-variant-numeric: tabular-nums;
}

.check-list__summary {
  color: var(--gitpulse-text-subtle, #9ca3af);
}

/* Wide containers: plain duration rows stay compact on a single line while
   detailed rows (with title/description) keep the two-line stack. */
@container (min-width: 480px) {
  .check-list__row:not(.check-list__row--detailed) {
    align-items: center;
  }

  .check-list__row:not(.check-list__row--detailed) .check-list__body {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  .check-list__row:not(.check-list__row--detailed) .check-list__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow-wrap: normal;
  }

  .check-list__row:not(.check-list__row--detailed) .check-list__meta {
    flex: none;
    white-space: nowrap;
    text-align: right;
  }
}
</style>
