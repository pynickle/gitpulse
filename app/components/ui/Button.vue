<template>
  <component :is="component" v-bind="bindProps" :class="classes">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

const {
  to,
  href,
  target,
  color = 'primary',
  size = 'large',
  lifted = true,
} = defineProps<{
  to?: string | object;
  href?: string;
  target?: string;
  color?: string;
  size?: 'normal' | 'large';
  lifted?: boolean;
}>();

const attrs = useAttrs();

const component = computed(() => {
  if (to) return 'NuxtLinkLocale';
  if (href) return 'a';
  return 'button';
});

const bindProps = computed(() => {
  const baseAttrs = { ...attrs };

  if (to) {
    return { ...baseAttrs, to: to };
  }
  if (href) {
    return { ...baseAttrs, href: href, target: target };
  }
  return { ...baseAttrs, type: (attrs.type as string | undefined) ?? 'button' };
});

const classes = computed(() => [
  'button',
  size === 'large' ? 'is-large' : null,
  color ? `is-${color}` : null,
  lifted ? 'is-lifted' : null,
  'px-6',
]);
</script>

<style scoped lang="scss">
.button {
  font-size: 1.1rem;
}
</style>
