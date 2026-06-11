<template>
  <div class="sidebar-card">
    <div class="sidebar-card__header">
      <div class="sidebar-card__header-left">
        <ExternalLinkIcon :size="14" class="sidebar-card__icon" />
        <span class="sidebar-card__title">{{ t('dashboard.widgets.actions.title') }}</span>
      </div>
    </div>

    <div class="sidebar-card__content">
      <div class="quick-actions__links">
        <a
          v-for="link in currentConfig.links"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          class="sidebar-link"
        >
          <ExternalLinkIcon :size="14" />
          <span>{{ link.label }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExternalLinkIcon } from 'lucide-vue-next';
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
.sidebar-card {
  background: var(--gitpulse-surface-muted);
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
}

.sidebar-card__header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sidebar-card__icon {
  color: var(--gitpulse-accent);
}

.sidebar-card__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  letter-spacing: -0.01em;
}

.sidebar-card__content {
  padding: 12px 16px;
}

.quick-actions__links {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--gitpulse-text-muted);
  text-decoration: none;
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }
}
</style>
