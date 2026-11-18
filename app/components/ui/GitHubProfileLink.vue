<script setup lang="ts">
import { computed } from 'vue';

import { isGitHubWebHost, parseUrl } from '~/utils/githubUrlUtils';

const { login, currentLogin, githubHref } = defineProps<{
  login?: string | null;
  currentLogin?: string;
  githubHref?: string | null;
}>();

const { opensGitHubLinks } = useGitHubLinkRouting();
const githubPage = computed(() => {
  const url = githubHref ? parseUrl(githubHref) : null;
  return url?.protocol === 'https:' && isGitHubWebHost(url.hostname) ? url : null;
});
const targetLogin = computed(() => {
  const user = login?.trim();
  // GitHub Apps can return a display name such as Copilot in place of a bot login.
  if (githubPage.value?.pathname.startsWith('/apps/') && !user?.toLowerCase().endsWith('[bot]')) {
    return undefined;
  }
  return user;
});
const to = computed(() => {
  const user = targetLogin.value;
  if (!user || opensGitHubLinks.value || user.toLowerCase() === currentLogin?.toLowerCase()) {
    return null;
  }
  return resolveNavigationEntryRoute({ type: 'profile', data: { user } });
});

const externalHref = computed(() => {
  const user = targetLogin.value;
  if (!user) return githubHref;
  if (!opensGitHubLinks.value) return null;

  if (githubPage.value) return githubHref;

  // GitHub App bots have web pages under /apps, without the REST login's suffix.
  const botSlug = /^(.+)\[bot\]$/i.exec(user)?.[1];
  return botSlug
    ? `https://github.com/apps/${encodeURIComponent(botSlug)}`
    : `https://github.com/${encodeURIComponent(user)}`;
});
</script>

<template>
  <NuxtLinkLocale v-if="to" :to="to" aria-current-value="false"><slot /></NuxtLinkLocale>
  <a v-else-if="externalHref" :href="externalHref" target="_blank" rel="noopener noreferrer">
    <slot />
  </a>
  <span v-else><slot /></span>
</template>
