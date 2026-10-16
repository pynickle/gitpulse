<script setup lang="ts">
import SimpleBar from 'simplebar-vue';
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    axis?: 'x' | 'y' | 'both';
    disabled?: boolean;
    contentClass?: string;
    media?: string;
  }>(),
  { axis: 'y', disabled: false, contentClass: '', media: undefined }
);

const emit = defineEmits<{
  scrollElement: [element: HTMLElement | null];
  scroll: [event: Event];
}>();

// simplebar-vue's declaration omits the public instance exposed at runtime.
const bar = useTemplateRef<{ scrollElement?: HTMLElement }>('bar');
const scrollElement = shallowRef<HTMLElement | null>(null);
const matchesMedia = shallowRef(!props.media);
const enabled = computed(() => !props.disabled && matchesMedia.value);
let mediaQuery: MediaQueryList | undefined;
const syncMedia = () => {
  matchesMedia.value = mediaQuery?.matches ?? true;
};
const forwardScroll = (event: Event) => emit('scroll', event);

function publishElement(element: HTMLElement | null) {
  if (scrollElement.value === element) return;
  scrollElement.value?.removeEventListener('scroll', forwardScroll);
  scrollElement.value = element;
  element?.addEventListener('scroll', forwardScroll, { passive: true });
  emit('scrollElement', element);
}

watch(
  [bar, enabled],
  ([instance, active]) => publishElement(active ? (instance?.scrollElement ?? null) : null),
  {
    flush: 'post',
  }
);
onMounted(() => {
  watch(
    () => props.media,
    (query) => {
      mediaQuery?.removeEventListener('change', syncMedia);
      mediaQuery = query ? window.matchMedia(query) : undefined;
      mediaQuery?.addEventListener('change', syncMedia);
      syncMedia();
    },
    { immediate: true }
  );
  publishElement(enabled.value ? (bar.value?.scrollElement ?? null) : null);
});
onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncMedia);
  publishElement(null);
});
defineExpose({ scrollElement });
</script>

<template>
  <SimpleBar
    ref="bar"
    class="scroll-area"
    :class="[
      `scroll-area--${axis}`,
      { 'scroll-area--disabled': !enabled, 'scroll-area--custom-content': contentClass },
    ]"
    :style="{
      overflowX: !enabled ? 'visible' : axis === 'y' ? 'hidden' : 'auto',
      overflowY: !enabled ? 'visible' : axis === 'x' ? 'hidden' : 'auto',
    }"
    :auto-hide="true"
    :tab-index="enabled ? 0 : -1"
    :class-names="{ contentEl: `simplebar-content ${contentClass}`.trim() }"
  >
    <slot />
  </SimpleBar>
</template>

<style src="simplebar-vue/dist/simplebar.min.css"></style>
<style scoped lang="scss">
:where(.scroll-area) {
  min-width: 0;
  min-height: 0;
}

.scroll-area {
  &--y {
    overflow-x: hidden;
  }
  &--x {
    overflow-y: hidden;
  }

  > :deep(.simplebar-wrapper),
  > :deep(.simplebar-wrapper > .simplebar-mask),
  > :deep(.simplebar-wrapper > .simplebar-mask > .simplebar-offset),
  > :deep(.simplebar-wrapper > .simplebar-mask > .simplebar-offset > .simplebar-content-wrapper) {
    overscroll-behavior: inherit;
    overflow-anchor: inherit;
  }

  :deep(.simplebar-track.simplebar-vertical) {
    width: 8px;
  }
  :deep(.simplebar-track.simplebar-horizontal) {
    height: 8px;
  }
  :deep(.simplebar-scrollbar::before) {
    background: var(--gitpulse-scrollbar-thumb);
  }
  :deep(.simplebar-scrollbar.simplebar-visible::before) {
    opacity: 0.75;
  }
  :deep(.simplebar-track:hover .simplebar-scrollbar::before) {
    background: var(--gitpulse-text-muted);
    opacity: 1;
  }

  // Keep slot instances alive while responsive layouts hand scroll ownership
  // to another area. Flatten only this instance's library wrappers.
  &--disabled {
    overflow: visible;
    align-items: stretch;
    align-content: normal;
    flex-wrap: nowrap;
    > :deep(.simplebar-wrapper),
    > :deep(.simplebar-wrapper > .simplebar-mask),
    > :deep(.simplebar-wrapper > .simplebar-mask > .simplebar-offset),
    > :deep(.simplebar-wrapper > .simplebar-mask > .simplebar-offset > .simplebar-content-wrapper) {
      display: contents;
    }
    > :deep(.simplebar-track),
    > :deep(.simplebar-wrapper > .simplebar-placeholder),
    > :deep(.simplebar-wrapper > .simplebar-height-auto-observer-wrapper) {
      display: none;
    }
    > :deep(
      .simplebar-wrapper
        > .simplebar-mask
        > .simplebar-offset
        > .simplebar-content-wrapper
        > .simplebar-content
    ) {
      padding: 0 !important;
    }
  }

  &--custom-content
    > :deep(
      .simplebar-wrapper
        > .simplebar-mask
        > .simplebar-offset
        > .simplebar-content-wrapper
        > .simplebar-content::before
    ),
  &--custom-content
    > :deep(
      .simplebar-wrapper
        > .simplebar-mask
        > .simplebar-offset
        > .simplebar-content-wrapper
        > .simplebar-content::after
    ) {
    display: none;
  }

  &--disabled:not(.scroll-area--custom-content)
    > :deep(
      .simplebar-wrapper
        > .simplebar-mask
        > .simplebar-offset
        > .simplebar-content-wrapper
        > .simplebar-content
    ) {
    display: contents;
  }
}
</style>
