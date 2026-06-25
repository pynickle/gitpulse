<script setup lang="ts">
import { computed, inject } from 'vue';

import { markdownRepoContextKey } from '../../utils/markdownRepoPathUtils';

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
const {
  resolveDashboardUrlTarget,
  getDashboardUrlRoute,
  getPreferredDashboardUrlHref,
  trackDashboardUrlNavigation,
} = useDashboardUrlNavigation();
const { opensGitHubLinks } = useGitHubLinkRouting();

const internalTarget = computed(() =>
  resolveDashboardUrlTarget(props.href, markdownRepoContext?.value)
);

const preferredDashboardHref = computed(() => {
  const target = internalTarget.value;
  return target ? getPreferredDashboardUrlHref(target) : null;
});

const externalHref = computed(() => {
  if (opensGitHubLinks.value && preferredDashboardHref.value) {
    return preferredDashboardHref.value;
  }

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
  return target && !opensGitHubLinks.value ? getDashboardUrlRoute(target) : null;
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
  <a v-else-if="externalHref" :href="externalHref" :target="target" :rel="externalRel">
    <slot />
  </a>
  <span v-else>
    <slot />
  </span>
</template>
