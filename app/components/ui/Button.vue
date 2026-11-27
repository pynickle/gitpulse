<template>
  <NuxtLinkLocale
    v-if="to"
    v-bind="linkAttrs"
    :to="to"
    :class="classes"
    :aria-busy="loading || undefined"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :tabindex="resolvedLinkTabindex"
    @click="handleLinkClick"
  >
    <slot />
  </NuxtLinkLocale>
  <a
    v-else-if="href"
    v-bind="linkAttrs"
    :href="href"
    :target="target"
    :class="classes"
    :aria-busy="loading || undefined"
    :aria-disabled="isDisabled ? 'true' : undefined"
    :tabindex="resolvedLinkTabindex"
    @click="handleLinkClick"
  >
    <slot />
  </a>
  <button
    v-else
    v-bind="attrs"
    :type="type"
    :disabled="isDisabled"
    :class="classes"
    :aria-busy="loading || undefined"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'light'
  | 'ghost'
  | 'link'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'danger-soft';

type ButtonSize = 'small' | 'normal' | 'medium' | 'large';

defineOptions({ inheritAttrs: false });

const {
  to,
  href,
  target,
  variant = 'primary',
  size = 'normal',
  outlined = false,
  loading = false,
  disabled = false,
  block = false,
  pill = false,
  type = 'button',
} = defineProps<{
  to?: string | Record<string, unknown>;
  href?: string;
  target?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  outlined?: boolean;
  loading?: boolean;
  disabled?: boolean;
  block?: boolean;
  pill?: boolean;
  type?: 'button' | 'submit' | 'reset';
}>();

const attrs = useAttrs();

const isDisabled = computed(() => disabled || loading);

const linkAttrs = computed(() => {
  const { tabindex: _tabindex, ...rest } = attrs;
  return rest;
});

const resolvedLinkTabindex = computed(() => {
  if (isDisabled.value) return -1;
  return attrs.tabindex as string | number | undefined;
});

const handleLinkClick = (event: MouseEvent) => {
  if (isDisabled.value) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
};

const classes = computed(() => [
  'gp-btn',
  `gp-btn--${variant}`,
  size !== 'normal' ? `gp-btn--${size}` : null,
  outlined ? 'gp-btn--outlined' : null,
  block ? 'gp-btn--block' : null,
  pill ? 'gp-btn--pill' : null,
  loading ? 'gp-btn--loading' : null,
]);
</script>
