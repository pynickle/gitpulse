<template>
  <component :is="component" v-bind="bindProps" :class="classes">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

const props = withDefaults(
  defineProps<{
    to?: string | object;
    href?: string;
    target?: string;
    color?: string;
    size?: 'normal' | 'large';
    lifted?: boolean;
  }>(),
  {
    color: 'primary',
    size: 'large',
    lifted: true,
  }
);

const attrs = useAttrs();

const component = computed(() => {
  if (props.to) return 'NuxtLinkLocale';
  if (props.href) return 'a';
  return 'button';
});

const bindProps = computed(() => {
  const baseAttrs = { ...attrs };

  if (props.to) {
    return { ...baseAttrs, to: props.to };
  }
  if (props.href) {
    return { ...baseAttrs, href: props.href, target: props.target };
  }
  return { ...baseAttrs, type: (attrs.type as string | undefined) ?? 'button' };
});

const classes = computed(() => [
  'button',
  props.size === 'large' ? 'is-large' : null,
  props.color ? `is-${props.color}` : null,
  props.lifted ? 'is-lifted' : null,
  'px-6',
]);
</script>

<style scoped lang="scss">
.button {
  font-size: 1.1rem;
}
</style>
