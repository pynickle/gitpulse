<script setup lang="ts">
import {
  AlertTriangleIcon,
  CoffeeIcon,
  LockKeyholeIcon,
  MapPinOffIcon,
  ServerOffIcon,
} from '@lucide/vue';
import { computed } from 'vue';

import type { NuxtError } from '#app';
import LandingNavbar from '~/components/layouts/LandingNavbar.vue';
import Button from '~/components/ui/Button.vue';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const localePath = useLocalePath();

type ErrorAction = 'dashboard' | 'home' | 'retry' | 'back';

interface ErrorVariant {
  iconBg: string;
  iconColor: string;
  icon: typeof MapPinOffIcon;
  titleKey: string;
  descriptionKey: string;
  primary: { labelKey: string; action: ErrorAction };
  secondary: { labelKey: string; action: ErrorAction };
}

const fallbackVariant: ErrorVariant = {
  iconBg: 'var(--gitpulse-danger-soft)',
  iconColor: 'var(--gitpulse-danger)',
  icon: AlertTriangleIcon,
  titleKey: 'error.500.title',
  descriptionKey: 'error.500.description',
  primary: { labelKey: 'error.cta.retry', action: 'retry' },
  secondary: { labelKey: 'error.cta.home', action: 'home' },
};

const variants: Record<number, ErrorVariant> = {
  404: {
    iconBg: 'var(--gitpulse-accent-soft)',
    iconColor: 'var(--gitpulse-accent)',
    icon: MapPinOffIcon,
    titleKey: 'error.404.title',
    descriptionKey: 'error.404.description',
    primary: { labelKey: 'error.cta.dashboard', action: 'dashboard' },
    secondary: { labelKey: 'error.cta.back', action: 'back' },
  },
  500: {
    iconBg: 'var(--gitpulse-danger-soft)',
    iconColor: 'var(--gitpulse-danger)',
    icon: AlertTriangleIcon,
    titleKey: 'error.500.title',
    descriptionKey: 'error.500.description',
    primary: { labelKey: 'error.cta.retry', action: 'retry' },
    secondary: { labelKey: 'error.cta.home', action: 'home' },
  },
  403: {
    iconBg: 'var(--gitpulse-warning-soft)',
    iconColor: 'var(--gitpulse-warning)',
    icon: LockKeyholeIcon,
    titleKey: 'error.403.title',
    descriptionKey: 'error.403.description',
    primary: { labelKey: 'error.cta.dashboard', action: 'dashboard' },
    secondary: { labelKey: 'error.cta.home', action: 'home' },
  },
  503: {
    iconBg: 'var(--gitpulse-danger-soft)',
    iconColor: 'var(--gitpulse-danger)',
    icon: ServerOffIcon,
    titleKey: 'error.503.title',
    descriptionKey: 'error.503.description',
    primary: { labelKey: 'error.cta.retry', action: 'retry' },
    secondary: { labelKey: 'error.cta.home', action: 'home' },
  },
  418: {
    iconBg: 'var(--gitpulse-purple-soft)',
    iconColor: 'var(--gitpulse-purple)',
    icon: CoffeeIcon,
    titleKey: 'error.418.title',
    descriptionKey: 'error.418.description',
    primary: { labelKey: 'error.cta.home', action: 'home' },
    secondary: { labelKey: 'error.cta.dashboard', action: 'dashboard' },
  },
};

const variant = computed<ErrorVariant>(
  () => variants[props.error.status ?? 500] ?? fallbackVariant
);
const statusCode = computed<number>(() => props.error.status ?? 500);

const title = computed(() => t(variant.value.titleKey));
const description = computed(() => t(variant.value.descriptionKey));
const primaryLabel = computed(() => t(variant.value.primary.labelKey));
const secondaryLabel = computed(() => t(variant.value.secondary.labelKey));

const homePath = computed(() => localePath('/'));
const dashboardPath = computed(() => localePath('/dashboard'));

const runAction = (action: ErrorAction) => {
  if (action === 'retry') {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    return;
  }
  if (action === 'back') {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
    return;
  }
  const target = action === 'home' ? homePath.value : dashboardPath.value;
  void clearError({ redirect: target });
};

const handlePrimary = () => runAction(variant.value.primary.action);
const handleSecondary = () => runAction(variant.value.secondary.action);
</script>

<template>
  <div class="error-page">
    <LandingNavbar />
    <section class="hero is-fullheight-with-navbar error-page__hero">
      <div class="hero-body error-page__body">
        <div class="container has-text-centered error-page__container">
          <div class="error-card" data-testid="error-card">
            <div
              class="error-card__icon"
              :style="{ background: variant.iconBg, color: variant.iconColor }"
            >
              <component :is="variant.icon" :size="40" aria-hidden="true" />
            </div>
            <p class="error-card__code">{{ statusCode }}</p>
            <h1 class="error-card__title">{{ title }}</h1>
            <p class="error-card__description">{{ description }}</p>
            <div class="error-card__actions">
              <Button color="primary" @click="handlePrimary">
                {{ primaryLabel }}
              </Button>
              <Button color="light" @click="handleSecondary">
                {{ secondaryLabel }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.error-page {
  min-height: 100vh;
  background-color: var(--gitpulse-page-bg);
  color: var(--gitpulse-text);
}

.error-card {
  max-width: 480px;
  margin: 0 auto;
  padding: 3rem 2.5rem;
  background-color: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-xl);
  box-shadow: var(--gitpulse-shadow-raised);
  text-align: center;
}

.error-card__icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.75rem;
}

.error-card__code {
  font-size: 5rem;
  line-height: 1;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--gitpulse-text-strong);
  font-variant-numeric: tabular-nums;
  margin: 0 0 0.75rem;
}

.error-card__title {
  font-size: 1.75rem;
  line-height: 1.25;
  font-weight: 600;
  color: var(--gitpulse-text-strong);
  margin: 0 0 0.75rem;
}

.error-card__description {
  font-size: 1rem;
  line-height: 1.55;
  color: var(--gitpulse-text-muted);
  margin: 0 0 2rem;
}

.error-card__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
}

.error-card__actions :deep(.button) {
  width: 100%;
  max-width: 280px;
}

// Phone: a narrow column on the page, under the navbar and above the vertical center.
// Wider screens keep the raised card.
@media (max-width: 640px) {
  .error-page {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .error-page__hero.is-fullheight-with-navbar {
    flex: 1 0 auto;
    min-height: auto;
  }

  .error-page__hero.is-fullheight-with-navbar .error-page__body {
    align-items: flex-start;
    justify-content: center;
    padding: clamp(2.75rem, 12vh, 5.5rem) max(1.25rem, env(safe-area-inset-right, 0px))
      max(2rem, env(safe-area-inset-bottom, 0px)) max(1.25rem, env(safe-area-inset-left, 0px));
  }

  .error-page__hero.is-fullheight-with-navbar .error-page__body > .error-page__container {
    flex-grow: 0;
    flex-shrink: 0;
    width: min(100%, 17.5rem);
  }

  .error-card {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  .error-card__icon {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1.25rem;
  }

  .error-card__icon :deep(svg) {
    width: 28px;
    height: 28px;
  }

  .error-card__code {
    font-size: 3.25rem;
    margin-bottom: 0.5rem;
  }

  .error-card__title {
    font-size: 1.375rem;
    margin-bottom: 0.5rem;
  }

  .error-card__description {
    margin-bottom: 1.5rem;
  }

  .error-card__actions :deep(.button) {
    width: 100%;
    max-width: none;
  }

  // The light button fill matches the page background, so it needs its own edge.
  .error-card__actions :deep(.button.is-light) {
    background-color: var(--gitpulse-surface);
    border: 1px solid var(--gitpulse-border);
  }
}
</style>
