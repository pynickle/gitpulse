<script setup lang="ts">
import type { ComarkElement } from 'comark';
import { computed, inject, useAttrs } from 'vue';

import {
  buildRepoRawFileUrl,
  isSafeMarkdownResourceUrl,
  markdownRepoContextKey,
  parseMarkdownRepoResource,
  resolveMarkdownRepoSrcset,
} from '~/utils/markdown-repo-path-utils';

defineOptions({
  inheritAttrs: false,
});

const MEDIA_TAGS = new Set(['audio', 'img', 'source', 'track', 'video']);

const props = defineProps<{
  __node?: ComarkElement;
  src?: string;
  srcset?: string;
  poster?: string;
  alt?: string;
}>();

const attrs = useAttrs();
const runtimeConfig = useRuntimeConfig();
const markdownRepoContext = inject(markdownRepoContextKey, null);

const tag = computed(() => {
  const nodeTag = props.__node?.[0];
  return nodeTag && MEDIA_TAGS.has(nodeTag) ? nodeTag : 'span';
});

function applyAppBaseURL(src: string) {
  const baseURL = runtimeConfig.app.baseURL || '/';
  const normalizedBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;

  if (
    src.startsWith('/') &&
    !src.startsWith('//') &&
    normalizedBase !== '/' &&
    !src.startsWith(normalizedBase)
  ) {
    return `${normalizedBase.slice(0, -1)}${src}`;
  }

  return src;
}

function resolveResourceUrl(value: string | undefined) {
  const resource = parseMarkdownRepoResource(value, markdownRepoContext?.value);
  if (resource) {
    return applyAppBaseURL(buildRepoRawFileUrl(resource));
  }

  return value && isSafeMarkdownResourceUrl(value) ? value : undefined;
}

const resolvedAttrs = computed(() => ({
  ...attrs,
  src: resolveResourceUrl(props.src),
  srcset: resolveMarkdownRepoSrcset(props.srcset, markdownRepoContext?.value ?? {}, (resource) =>
    applyAppBaseURL(buildRepoRawFileUrl(resource))
  ),
  poster: resolveResourceUrl(props.poster),
  alt: tag.value === 'img' ? (props.alt ?? '') : props.alt,
}));
</script>

<template>
  <component :is="tag" v-bind="resolvedAttrs">
    <slot />
  </component>
</template>
