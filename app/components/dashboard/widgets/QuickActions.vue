<template>
  <div class="quick-actions" aria-labelledby="quick-actions-title">
    <h3 id="quick-actions-title" class="quick-actions__title">
      {{ t('dashboard.widgets.actions.title') }}
    </h3>

    <div class="quick-actions__tip">
      <span class="quick-actions__tip-icon" aria-hidden="true">
        <LightbulbIcon :size="16" />
      </span>
      <p class="quick-actions__tip-text">{{ currentConfig.tip }}</p>
    </div>

    <ul class="quick-actions__links">
      <li v-for="link in currentConfig.links" :key="link.href">
        <a class="quick-actions__link" :href="link.href" target="_blank" rel="noopener noreferrer">
          <span>{{ link.label }}</span>
          <ExternalLinkIcon :size="14" class="quick-actions__link-icon" aria-hidden="true" />
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ExternalLinkIcon, LightbulbIcon } from 'lucide-vue-next';
import { computed } from 'vue';

const { t } = useI18n();

const props = defineProps<{
  currentTab: string;
}>();

type GuideLink = {
  label: string;
  href: string;
};

type GuideConfig = {
  tip: string;
  links: GuideLink[];
};

const currentConfig = computed<GuideConfig>(() => {
  const fallbackConfig: GuideConfig = {
    tip: t('dashboard.widgets.actions.notifications.tip'),
    links: [
      {
        label: t('dashboard.widgets.actions.notifications.settings'),
        href: 'https://github.com/settings/notifications',
      },
    ],
  };

  const configs: Record<string, GuideConfig> = {
    notifications: {
      ...fallbackConfig,
    },
    issues: {
      tip: t('dashboard.widgets.actions.issues.tip'),
      links: [
        {
          label: t('dashboard.widgets.actions.issues.mine'),
          href: 'https://github.com/issues',
        },
      ],
    },
    pulls: {
      tip: t('dashboard.widgets.actions.pulls.tip'),
      links: [
        {
          label: t('dashboard.widgets.actions.pulls.mine'),
          href: 'https://github.com/pulls',
        },
        {
          label: t('dashboard.widgets.actions.pulls.reviewRequests'),
          href: 'https://github.com/pulls?q=is%3Aopen+is%3Apr+review-requested%3A%40me',
        },
      ],
    },
    repos: {
      tip: t('dashboard.widgets.actions.repos.tip'),
      links: [
        {
          label: t('dashboard.widgets.actions.repos.new'),
          href: 'https://github.com/new',
        },
      ],
    },
  };

  return configs[props.currentTab] ?? fallbackConfig;
});
</script>

<style scoped lang="scss">
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding-top: 0.25rem;

  &__title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--gitpulse-text-muted);
    margin-bottom: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__tip {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.875rem;
    border: 1px solid var(--gitpulse-border);
    border-radius: 12px;
    background:
      linear-gradient(135deg, var(--gitpulse-info-soft), var(--gitpulse-success-soft)),
      var(--gitpulse-surface);
  }

  &__tip-icon {
    display: inline-flex;
    color: var(--gitpulse-warning);
    margin-top: 0.125rem;
    flex-shrink: 0;
  }

  &__tip-text {
    margin: 0;
    color: var(--bulma-text);
    font-size: 0.875rem;
    line-height: 1.45;
  }

  &__links {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    margin-left: -0.75rem;
    margin-right: -0.75rem;
    border-radius: 8px;
    color: var(--bulma-text);
    font-size: 0.875rem;
    font-weight: 500;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover,
    &:focus-visible {
      color: var(--bulma-link);
      background-color: var(--bulma-background-hover);

      .quick-actions__link-icon {
        transform: translate(2px, -2px);
      }
    }
  }

  &__link-icon {
    color: var(--gitpulse-text-subtle);
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }
}
</style>
