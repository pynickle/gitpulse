<script setup lang="ts">
import { parse } from 'comark';
import type { ComarkTree } from 'comark';
import highlight from 'comark/plugins/highlight';
import security from 'comark/plugins/security';
import type { DefineComponent } from 'vue';
import { shallowRef } from 'vue';

import MarkdownRendererProseA from '~/components/ui/MarkdownRendererProseA.vue';
import MarkdownRendererProseImg from '~/components/ui/MarkdownRendererProseImg.vue';
import MarkdownRendererProseMermaidWrapper from '~/components/ui/MarkdownRendererProseMermaidWrapper.vue';
import useGitHubAutolinks from '~/composables/useGitHubAutolinks';

const props = defineProps<{
  value: string;
  repoOwner?: string;
  repoName?: string;
}>();

const ast = shallowRef<ComarkTree | null>(null);
const renderRequestId = shallowRef(0);
const { applyGitHubAutolinks } = useGitHubAutolinks();
const markdownPlugins = [
  security({
    blockedTags: ['script', 'style', 'iframe', 'object', 'embed'],
    allowedProtocols: ['http', 'https', 'mailto', 'tel'],
    allowDataImages: false,
  }),
  highlight(),
];

const rendererComponents: Record<string, string | DefineComponent<any, any, any>> = {
  a: MarkdownRendererProseA,
  img: MarkdownRendererProseImg,
  pre: MarkdownRendererProseMermaidWrapper,
};

watch(
  () => [props.value, props.repoOwner, props.repoName],
  async ([value, repoOwner, repoName]) => {
    const requestId = renderRequestId.value + 1;
    renderRequestId.value = requestId;

    if (!value) {
      ast.value = null;
      return;
    }

    const parsedMarkdown = await parse(value, {
      plugins: markdownPlugins,
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
    white-space: pre-wrap;
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
