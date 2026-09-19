<script setup lang="ts">
import { UserIcon } from '@lucide/vue';
import { computed, ref } from 'vue';

import {
  createSizedGitHubAvatarUrl,
  resolveGitHubAvatarDisplaySize,
} from '#shared/utils/github-avatar-url';

import { useDeferredElementLoad } from './deferredElementLoad';

type GitHubAvatarVariant = 'plain' | 'raised';
type GitHubAvatarLoading = 'eager' | 'lazy';
type GitHubAvatarFetchPriority = 'high' | 'low' | 'auto';
type GitHubAvatarPreload = boolean | { fetchPriority?: GitHubAvatarFetchPriority };
type NuxtImagePreload = boolean | { fetchPriority: GitHubAvatarFetchPriority };

const props = withDefaults(
  defineProps<{
    src?: string | null;
    alt?: string | null;
    size?: number | string;
    width?: number | string;
    height?: number | string;
    /** Skip inline width/height so CSS can size the box. `size` still drives the image URL. */
    fluid?: boolean;
    loading?: GitHubAvatarLoading;
    fetchPriority?: GitHubAvatarFetchPriority;
    preload?: GitHubAvatarPreload;
    variant?: GitHubAvatarVariant;
    interactive?: boolean;
  }>(),
  {
    alt: '',
    loading: 'lazy',
    fluid: false,
    variant: 'plain',
    interactive: false,
  }
);

const toCssSize = (value: number | string | undefined) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'number') return `${value}px`;
  return /^\d+$/.test(value) ? `${value}px` : value;
};

const resolvedWidth = computed(() => toCssSize(props.width ?? props.size));
const resolvedHeight = computed(() => toCssSize(props.height ?? props.size));
const avatarElement = ref<HTMLElement | null>(null);

const avatarStyle = computed(() => {
  if (props.fluid) {
    return undefined;
  }

  return {
    width: resolvedWidth.value,
    height: resolvedHeight.value,
  };
});

const imageWidth = computed(() => props.width ?? props.size);
const imageHeight = computed(() => props.height ?? props.size);
const imageDisplaySize = computed(() =>
  resolveGitHubAvatarDisplaySize(imageWidth.value, imageHeight.value)
);
const imageSrc = computed(
  () => createSizedGitHubAvatarUrl(props.src, imageDisplaySize.value) ?? undefined
);
const shouldDeferImage = computed(() => props.loading !== 'eager');
const imageShouldLoad = useDeferredElementLoad(avatarElement, shouldDeferImage, imageSrc);
const fallbackLabel = computed(() => props.alt?.trim() || 'GitHub avatar');
const resolvedPreload = computed<NuxtImagePreload | undefined>(() => {
  if (props.preload === undefined || typeof props.preload === 'boolean') return props.preload;
  if (!props.preload.fetchPriority) return undefined;
  return { fetchPriority: props.preload.fetchPriority };
});
</script>

<template>
  <span
    ref="avatarElement"
    class="github-avatar"
    :class="[
      `github-avatar--${variant}`,
      {
        'github-avatar--fluid': fluid,
        'github-avatar--interactive': interactive,
      },
    ]"
    :style="avatarStyle"
  >
    <NuxtImg
      v-if="src && imageShouldLoad"
      :src="imageSrc"
      :alt="alt || ''"
      :width="imageWidth"
      :height="imageHeight"
      :loading="loading"
      :fetchpriority="fetchPriority"
      :preload="resolvedPreload"
      class="github-avatar__image"
    />
    <span v-else class="github-avatar__fallback" role="img" :aria-label="fallbackLabel">
      <slot name="fallback">
        <UserIcon :size="14" />
      </slot>
    </span>
  </span>
</template>

<style scoped lang="scss">
$motion-normal: 0.3s;

.github-avatar {
  --github-avatar-bg: transparent;
  --github-avatar-ring: 0 0 0 0 transparent;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 50%;
  background: var(--github-avatar-bg);
  box-shadow: var(--github-avatar-ring);
  vertical-align: middle;
  color: var(--gitpulse-text-muted);
}

.github-avatar--fluid {
  width: 100%;
  height: 100%;
}

.github-avatar--raised {
  box-shadow: var(--github-avatar-ring), var(--gitpulse-shadow-card);
}

.github-avatar--interactive {
  transition: transform $motion-normal ease;

  &:hover {
    transform: scale(1.05);
  }
}

.github-avatar__image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--github-avatar-bg);
  object-fit: cover;
}

.github-avatar__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--gitpulse-surface-hover);
}

:global(html.dark) .github-avatar,
:global(html[data-color-mode='dark']) .github-avatar {
  --github-avatar-bg: #fff;
  --github-avatar-ring: 0 0 0 1px color-mix(in srgb, var(--gitpulse-text-strong) 18%, transparent);
}
</style>
