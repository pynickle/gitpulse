<script setup lang="ts">
import type { ComarkElement } from 'comark';
import { computed, inject, ref, useAttrs } from 'vue';

import { resolveMarkdownColorModeSourceMedia } from '#shared/utils/markdown-color-mode-source-media';

import {
  buildRepoRawFileUrl,
  isSafeMarkdownResourceUrl,
  markdownRepoContextKey,
  parseMarkdownRepoResource,
  resolveMarkdownRepoSrcset,
} from '../../utils/markdownRepoPathUtils';
import { useDeferredElementLoad } from './deferredElementLoad';

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
  media?: string;
}>();

const attrs = useAttrs();
const runtimeConfig = useRuntimeConfig();
const colorMode = useColorMode();
const markdownRepoContext = inject(markdownRepoContextKey, null);
const imageElement = ref<HTMLImageElement | null>(null);

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

function hasAttrValue(value: unknown, expected: string) {
  return typeof value === 'string' && value.toLowerCase() === expected;
}

const shouldDeferImage = computed(
  () =>
    tag.value === 'img' &&
    !hasAttrValue(attrs.loading, 'eager') &&
    !hasAttrValue(attrs.fetchpriority ?? attrs.fetchPriority, 'high')
);
const imageLoadKey = computed(() => `${props.src ?? ''}\n${props.srcset ?? ''}`);
const imageShouldLoad = useDeferredElementLoad(imageElement, shouldDeferImage, imageLoadKey);

const resolvedAttrs = computed(() => {
  const resolved = {
    ...attrs,
    src: resolveResourceUrl(props.src),
    srcset: resolveMarkdownRepoSrcset(props.srcset, markdownRepoContext?.value ?? {}, (resource) =>
      applyAppBaseURL(buildRepoRawFileUrl(resource))
    ),
    poster: resolveResourceUrl(props.poster),
    alt: tag.value === 'img' ? (props.alt ?? '') : props.alt,
    media:
      tag.value === 'source'
        ? resolveMarkdownColorModeSourceMedia(props.media, colorMode.value)
        : props.media,
  };

  if (tag.value !== 'img') {
    return resolved;
  }

  return {
    ...resolved,
    loading: attrs.loading ?? 'lazy',
    decoding: attrs.decoding ?? 'async',
  };
});

const renderedImageAttrs = computed(() => {
  const resolved = resolvedAttrs.value;

  if (!shouldDeferImage.value || imageShouldLoad.value) {
    return resolved;
  }

  return {
    ...resolved,
    src: undefined,
    srcset: undefined,
    'data-src': resolved.src,
    'data-srcset': resolved.srcset,
  };
});
</script>

<template>
  <img v-if="tag === 'img'" ref="imageElement" v-bind="renderedImageAttrs" />
  <component v-else :is="tag" v-bind="resolvedAttrs">
    <slot />
  </component>
</template>
