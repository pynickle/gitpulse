<script setup lang="ts">
import { computed } from 'vue';

import parseGitHubMarkdownTarget from '~/utils/parseGitHubMarkdownTarget';

const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const props = withDefaults(
  defineProps<{
    href?: string;
    target?: string;
  }>(),
  {
    href: '',
  }
);

const localePath = useLocalePath();

const internalTarget = computed(() => parseGitHubMarkdownTarget(props.href));

const externalHref = computed(() => {
  const href = props.href.trim();

  if (!href) return null;

  if (
    href.startsWith('/') ||
    href.startsWith('./') ||
    href.startsWith('../') ||
    href.startsWith('#')
  ) {
    return href;
  }

  try {
    const url = new URL(href);
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
});

const internalTo = computed(() => {
  const target = internalTarget.value;
  if (!target) return null;

  return localePath({
    path: '/dashboard',
    query: {
      issue:
        target.type === 'issue' ? `${target.owner}/${target.repo}/${target.number}` : undefined,
      pr:
        target.type === 'pull-request'
          ? `${target.owner}/${target.repo}/${target.number}`
          : undefined,
    },
  });
});

const externalRel = computed(() => (props.target === '_blank' ? 'noopener noreferrer' : undefined));
</script>

<template>
  <NuxtLinkLocale v-if="internalTo" :to="internalTo" :target="target">
    <slot />
  </NuxtLinkLocale>
  <NuxtLink v-else-if="externalHref" :href="externalHref" :target="target" :rel="externalRel">
    <slot />
  </NuxtLink>
  <span v-else>
    <slot />
  </span>
</template>
