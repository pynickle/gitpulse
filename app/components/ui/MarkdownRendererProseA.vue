<script setup lang="ts">
import { computed } from 'vue';

import parseGitHubMarkdownTarget from '~/utils/parseGitHubMarkdownTarget';

const props = defineProps({
  href: {
    type: String,
    default: '',
  },
  target: {
    type: String,
    default: undefined,
    required: false,
  },
});

const localePath = useLocalePath();

const internalTarget = computed(() => parseGitHubMarkdownTarget(props.href));

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

const externalHref = computed(() => props.href);
</script>

<template>
  <NuxtLinkLocale v-if="internalTo" :to="internalTo" :target="target">
    <slot />
  </NuxtLinkLocale>
  <NuxtLink v-else :href="externalHref" :target="target">
    <slot />
  </NuxtLink>
</template>
