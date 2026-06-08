<script setup lang="ts">
import { UserIcon } from 'lucide-vue-next';
import { computed } from 'vue';

type GitHubAvatarVariant = 'plain' | 'raised';
type GitHubAvatarLoading = 'eager' | 'lazy';

const props = withDefaults(
  defineProps<{
    src?: string | null;
    alt?: string | null;
    size?: number | string;
    width?: number | string;
    height?: number | string;
    loading?: GitHubAvatarLoading;
    variant?: GitHubAvatarVariant;
    interactive?: boolean;
  }>(),
  {
    alt: '',
    loading: 'lazy',
    variant: 'plain',
    interactive: false,
  }
);

const colorMode = useColorMode();

const toCssSize = (value: number | string | undefined) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'number') return `${value}px`;
  return /^\d+$/.test(value) ? `${value}px` : value;
};

const resolvedWidth = computed(() => toCssSize(props.width ?? props.size));
const resolvedHeight = computed(() => toCssSize(props.height ?? props.size));

const avatarStyle = computed(() => ({
  width: resolvedWidth.value,
  height: resolvedHeight.value,
}));

const imageWidth = computed(() => props.width ?? props.size);
const imageHeight = computed(() => props.height ?? props.size);
const fallbackLabel = computed(() => props.alt?.trim() || 'GitHub avatar');
const isDarkMode = computed(() => colorMode.value === 'dark');
</script>

<template>
  <span
    class="github-avatar"
    :class="[
      `github-avatar--${variant}`,
      {
        'github-avatar--interactive': interactive,
        'github-avatar--dark': isDarkMode,
      },
    ]"
    :style="avatarStyle"
  >
    <NuxtImg
      v-if="src"
      :src="src"
      :alt="alt || ''"
      :width="imageWidth"
      :height="imageHeight"
      :loading="loading"
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

.github-avatar--dark,
:global(html.dark) .github-avatar,
:global(html[data-color-mode='dark']) .github-avatar {
  --github-avatar-bg: #fff;
  --github-avatar-ring: 0 0 0 1px color-mix(in srgb, var(--gitpulse-text-strong) 18%, transparent);
}
</style>
