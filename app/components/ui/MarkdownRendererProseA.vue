<script setup lang="ts">
import { computed, inject } from 'vue';

import { markdownRepoContextKey } from '../../utils/markdownRepoPathUtils';

const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

const { href = '', target } = defineProps<{
  href?: string;
  target?: string;
}>();

const markdownRepoContext = inject(markdownRepoContextKey, null);
const { resolveDashboardUrlTarget, getDashboardUrlRoute, getPreferredDashboardUrlHref } =
  useDashboardUrlNavigation();
const { opensGitHubLinks } = useGitHubLinkRouting();

const internalTarget = computed(() => resolveDashboardUrlTarget(href, markdownRepoContext?.value));

const preferredDashboardHref = computed(() => {
  const target = internalTarget.value;
  return target ? getPreferredDashboardUrlHref(target) : null;
});

const externalHref = computed(() => {
  if (opensGitHubLinks.value && preferredDashboardHref.value) {
    return preferredDashboardHref.value;
  }

  const trimmedHref = href.trim();

  if (!trimmedHref) return null;

  if (
    trimmedHref.startsWith('/') ||
    trimmedHref.startsWith('./') ||
    trimmedHref.startsWith('../') ||
    trimmedHref.startsWith('#')
  ) {
    return trimmedHref;
  }

  try {
    const url = new URL(trimmedHref);
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) ? trimmedHref : null;
  } catch {
    return null;
  }
});

const internalTo = computed(() => {
  const target = internalTarget.value;
  return target && !opensGitHubLinks.value ? getDashboardUrlRoute(target) : null;
});

const externalRel = computed(() => (target === '_blank' ? 'noopener noreferrer' : undefined));
</script>

<template>
  <NuxtLinkLocale v-if="internalTo" :to="internalTo" :target="target">
    <slot />
  </NuxtLinkLocale>
  <a v-else-if="externalHref" :href="externalHref" :target="target" :rel="externalRel">
    <slot />
  </a>
  <span v-else>
    <slot />
  </span>
</template>
