<script setup lang="ts">
import { computed, inject } from 'vue';

import { markdownRepoContextKey } from '~/utils/markdown-repo-path-utils';

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

const markdownRepoContext = inject(markdownRepoContextKey, null);
const { resolveDashboardUrlTarget, getDashboardUrlRoute, trackDashboardUrlNavigation } =
  useDashboardUrlNavigation();

const internalTarget = computed(() =>
  resolveDashboardUrlTarget(props.href, markdownRepoContext?.value)
);

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
  return target ? getDashboardUrlRoute(target) : null;
});

const externalRel = computed(() => (props.target === '_blank' ? 'noopener noreferrer' : undefined));

const trackInternalNavigation = () => {
  const target = internalTarget.value;
  if (target) {
    trackDashboardUrlNavigation(target);
  }
};
</script>

<template>
  <NuxtLinkLocale
    v-if="internalTo"
    :to="internalTo"
    :target="target"
    @click="trackInternalNavigation"
  >
    <slot />
  </NuxtLinkLocale>
  <NuxtLink v-else-if="externalHref" :href="externalHref" :target="target" :rel="externalRel">
    <slot />
  </NuxtLink>
  <span v-else>
    <slot />
  </span>
</template>
