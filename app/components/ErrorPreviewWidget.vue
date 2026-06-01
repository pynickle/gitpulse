<script setup lang="ts">
import { ConstructionIcon } from 'lucide-vue-next';
import { onBeforeUnmount, onMounted, ref } from 'vue';

interface ErrorPreset {
  statusCode: number;
  label: string;
  background: string;
  color: string;
  message: string;
}

const { t } = useI18n();

const open = ref(false);
const widgetRef = ref<HTMLElement | null>(null);

const errors: ErrorPreset[] = [
  {
    statusCode: 404,
    label: '404',
    background: 'var(--gitpulse-accent-soft)',
    color: 'var(--gitpulse-accent)',
    message: 'Page not found',
  },
  {
    statusCode: 500,
    label: '500',
    background: 'var(--gitpulse-danger-soft)',
    color: 'var(--gitpulse-danger)',
    message: 'Internal Server Error',
  },
  {
    statusCode: 403,
    label: '403',
    background: 'var(--gitpulse-warning-soft)',
    color: 'var(--gitpulse-warning)',
    message: 'Forbidden',
  },
  {
    statusCode: 503,
    label: '503',
    background: 'var(--gitpulse-danger-soft)',
    color: 'var(--gitpulse-danger)',
    message: 'Service Unavailable',
  },
  {
    statusCode: 418,
    label: '418',
    background: 'var(--gitpulse-purple-soft)',
    color: 'var(--gitpulse-purple)',
    message: "I'm a teapot",
  },
];

const trigger = (preset: ErrorPreset) => {
  open.value = false;
  showError({ statusCode: preset.statusCode, statusMessage: preset.message });
};

const handleDocumentClick = (event: MouseEvent) => {
  if (!open.value) return;
  const target = event.target;
  if (target instanceof Node && widgetRef.value && !widgetRef.value.contains(target)) {
    open.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<template>
  <div ref="widgetRef" class="error-preview-widget" data-testid="error-preview-widget">
    <Transition name="error-preview-widget__panel">
      <div v-if="open" class="error-preview-widget__panel" role="menu">
        <p class="error-preview-widget__title">{{ t('error.devWidget.panelTitle') }}</p>
        <div class="error-preview-widget__buttons">
          <button
            v-for="preset in errors"
            :key="preset.statusCode"
            type="button"
            class="error-preview-widget__btn"
            :style="{ background: preset.background, color: preset.color }"
            @click="trigger(preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
    </Transition>
    <button
      type="button"
      class="error-preview-widget__fab"
      :aria-label="t('error.devWidget.trigger')"
      :title="t('error.devWidget.trigger')"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <ConstructionIcon :size="20" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.error-preview-widget {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.error-preview-widget__panel {
  background: var(--gitpulse-surface);
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg);
  box-shadow: var(--gitpulse-shadow-raised);
  padding: 12px 14px;
  min-width: 220px;
}

.error-preview-widget__title {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--gitpulse-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.error-preview-widget__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.error-preview-widget__btn {
  appearance: none;
  border: none;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: var(--gitpulse-radius-md);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;

  &:hover,
  &:focus-visible {
    transform: translateY(-1px);
    box-shadow: var(--gitpulse-shadow-card);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.error-preview-widget__fab {
  appearance: none;
  background: var(--gitpulse-surface);
  color: var(--gitpulse-text-strong);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--gitpulse-border);
  box-shadow: var(--gitpulse-shadow-raised);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease;

  &:hover,
  &:focus-visible {
    transform: translateY(-2px);
    box-shadow: var(--gitpulse-shadow-card-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.error-preview-widget__panel-enter-active,
.error-preview-widget__panel-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.error-preview-widget__panel-enter-from,
.error-preview-widget__panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
