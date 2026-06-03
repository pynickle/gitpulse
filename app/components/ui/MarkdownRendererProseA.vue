<script setup lang="ts">
import { computed, inject } from 'vue';

import {
  buildRepoFileDashboardQuery,
  markdownRepoContextKey,
  parseMarkdownRepoResource,
} from '~/utils/markdown-repo-path-utils';
import parseGitHubMarkdownTarget from '~/utils/parseGitHubMarkdownTarget';
import parseGitHubRepoPath from '~/utils/parseGitHubRepoPath';

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
const { navigateToFile, navigateToRepo } = useNavigationHistory();
const markdownRepoContext = inject(markdownRepoContextKey, null);

const internalTarget = computed(() => parseGitHubMarkdownTarget(props.href));
const internalRepoResource = computed(() =>
  parseMarkdownRepoResource(props.href, markdownRepoContext?.value)
);
const internalRepoTarget = computed(() => {
  const href = props.href.trim();
  if (!href) return null;

  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    const GITHUB_WEB_HOSTS = new Set(['github.com', 'www.github.com']);
    if (!GITHUB_WEB_HOSTS.has(host)) return null;

    return parseGitHubRepoPath(href);
  } catch {
    return null;
  }
});
const internalRepoTargetBranch = computed(() => {
  const repoTarget = internalRepoTarget.value;
  const context = markdownRepoContext?.value;
  if (
    !repoTarget ||
    !context?.branch ||
    context.owner?.toLowerCase() !== repoTarget.owner.toLowerCase() ||
    context.repo?.toLowerCase() !== repoTarget.repo.toLowerCase()
  ) {
    return undefined;
  }

  return context.branch;
});

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
  if (target) {
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
  }

  const repoTarget = internalRepoTarget.value;
  if (repoTarget) {
    return localePath({
      path: '/dashboard',
      query: { repo: repoTarget.fullName, branch: internalRepoTargetBranch.value },
    });
  }

  const resource = internalRepoResource.value;
  if (!resource) return null;

  return localePath({
    path: '/dashboard',
    query: buildRepoFileDashboardQuery(resource),
    hash: resource.hash,
  });
});

const externalRel = computed(() => (props.target === '_blank' ? 'noopener noreferrer' : undefined));

const trackInternalNavigation = () => {
  const resource = internalRepoResource.value;
  if (resource) {
    navigateToFile(resource.owner, resource.repo, resource.path, resource.branch);
    return;
  }

  const repoTarget = internalRepoTarget.value;
  if (repoTarget) {
    navigateToRepo(repoTarget.owner, repoTarget.repo, undefined, internalRepoTargetBranch.value);
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
