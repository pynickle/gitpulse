<script setup lang="ts">
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { parse } from 'comark';
import type { ComarkTree } from 'comark';
import highlight from 'comark/plugins/highlight';
import security from 'comark/plugins/security';
import type { LanguageRegistration } from 'shiki';
import { bundledLanguages } from 'shiki/langs';
import type { DefineComponent } from 'vue';
import { computed, provide, shallowRef } from 'vue';

import MarkdownRendererProseA from '~/components/ui/MarkdownRendererProseA.vue';
import MarkdownRendererProseMedia from '~/components/ui/MarkdownRendererProseMedia.vue';
import MarkdownRendererProseMermaidWrapper from '~/components/ui/MarkdownRendererProseMermaidWrapper.vue';
import useGitHubAutolinks from '~/composables/useGitHubAutolinks';
import fixHtmlBlockIndentation from '~/utils/comark-fix-html-indentation';
import { markdownRepoContextKey } from '~/utils/markdown-repo-path-utils';

const props = defineProps<{
  value: string;
  repoOwner?: string;
  repoName?: string;
  basePath?: string;
  branch?: string;
}>();

const ast = shallowRef<ComarkTree | null>(null);
const renderRequestId = shallowRef(0);
const { applyGitHubAutolinks } = useGitHubAutolinks();
const markdownPluginsPromise = createMarkdownPlugins();
const markdownRepoContext = computed(() => ({
  owner: props.repoOwner,
  repo: props.repoName,
  basePath: props.basePath,
  branch: props.branch,
}));

provide(markdownRepoContextKey, markdownRepoContext);

async function createMarkdownPlugins() {
  const languages = await loadBundledLanguages();

  return [
    fixHtmlBlockIndentation(),
    security({
      blockedTags: ['script', 'style', 'iframe', 'object', 'embed'],
      allowedProtocols: ['http', 'https', 'mailto', 'tel'],
      allowDataImages: false,
    }),
    highlight({
      themes: {
        light: githubLight,
        dark: githubDark,
      },
      languages,
      preStyles: true,
    }),
  ];
}

async function loadBundledLanguages(): Promise<LanguageRegistration[]> {
  const modules = await Promise.all(
    Object.values(bundledLanguages).map((loadLanguage) => loadLanguage())
  );

  return modules.flatMap((module) => module.default ?? module) as LanguageRegistration[];
}

const rendererComponents: Record<string, string | DefineComponent<any, any, any>> = {
  a: MarkdownRendererProseA,
  audio: MarkdownRendererProseMedia,
  img: MarkdownRendererProseMedia,
  pre: MarkdownRendererProseMermaidWrapper,
  source: MarkdownRendererProseMedia,
  track: MarkdownRendererProseMedia,
  video: MarkdownRendererProseMedia,
};

watch(
  () => [props.value, props.repoOwner, props.repoName, props.basePath, props.branch],
  async ([value, repoOwner, repoName]) => {
    const requestId = renderRequestId.value + 1;
    renderRequestId.value = requestId;

    if (!value) {
      ast.value = null;
      return;
    }

    const parsedMarkdown = await parse(value, {
      plugins: await markdownPluginsPromise,
    });

    await applyGitHubAutolinks(parsedMarkdown, {
      repoOwner,
      repoName,
    });

    if (requestId !== renderRequestId.value) {
      return;
    }

    ast.value = parsedMarkdown;
  },
  { immediate: true }
);
</script>

<template>
  <ComarkRenderer v-if="ast" class="markdown-body" :tree="ast" :components="rendererComponents" />
</template>

<style lang="scss" src="@primer/css/color-modes/themes/light.scss" />
<style lang="scss" src="@primer/css/color-modes/themes/dark.scss" />
<style lang="scss" src="@primer/css/primitives/index.scss" />
<style lang="scss" src="@primer/css/markdown/index.scss" />
<style lang="scss">
.markdown-body {
  font-size: 14px;
  p {
    white-space: normal;
  }
  hr {
    display: revert;
  }
  h3:not(:first-child) {
    margin-top: revert;
  }
  code {
    color: revert;
    font-weight: revert;
  }
  blockquote:not(:last-child) {
    margin-bottom: revert;
  }
  blockquote {
    background-color: revert;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  ul {
    list-style: none;
    margin-inline-start: revert;
    padding-left: 1em;
  }

  a > img {
    margin-right: 4px;
  }
}
</style>
