<script setup lang="ts">
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { parse } from 'comark';
import type { ComarkNode, ComarkTree } from 'comark';
import { highlightCodeBlocks } from 'comark/plugins/highlight';
import security from 'comark/plugins/security';
import type { LanguageRegistration } from 'shiki';
import { bundledLanguages, type BundledLanguage } from 'shiki/langs';
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
const markdownPlugins = createMarkdownPlugins();
const markdownRepoContext = computed(() => ({
  owner: props.repoOwner,
  repo: props.repoName,
  basePath: props.basePath,
  branch: props.branch,
}));

provide(markdownRepoContextKey, markdownRepoContext);

function createMarkdownPlugins() {
  return [
    fixHtmlBlockIndentation(),
    security({
      blockedTags: ['script', 'style', 'iframe', 'object', 'embed'],
      allowedProtocols: ['http', 'https', 'mailto', 'tel'],
      allowDataImages: false,
    }),
  ];
}

const languageRegistrationPromises = new Map<string, Promise<LanguageRegistration[]>>();
let highlightQueue: Promise<void> = Promise.resolve();

async function highlightMarkdownCodeBlocks(tree: ComarkTree): Promise<ComarkTree> {
  const languages = await loadMarkdownLanguages(tree);

  const highlightedTree = highlightQueue.then(() =>
    highlightCodeBlocks(tree, {
      themes: {
        light: githubLight,
        dark: githubDark,
      },
      registerDefaultLanguages: false,
      registerDefaultThemes: false,
      languages,
      preStyles: true,
    })
  );

  // Comark keeps a module-level highlighter; serialize registration so concurrent renders
  // cannot tokenize before their language grammars are loaded.
  highlightQueue = highlightedTree.then(
    () => undefined,
    () => undefined
  );

  return highlightedTree;
}

async function loadMarkdownLanguages(tree: ComarkTree): Promise<LanguageRegistration[]> {
  const languages = extractCodeBlockLanguages(tree);
  const modules = await Promise.all([...languages].map((language) => loadLanguage(language)));

  return modules.flat();
}

function extractCodeBlockLanguages(tree: ComarkTree): Set<string> {
  const languages = new Set<string>();

  for (const node of tree.nodes) {
    collectCodeBlockLanguages(node, languages);
  }

  return languages;
}

function collectCodeBlockLanguages(node: ComarkNode, languages: Set<string>) {
  if (!Array.isArray(node)) {
    return;
  }

  if (node[0] === 'pre') {
    const language = normalizeLanguage(node[1].language);
    if (language && language in bundledLanguages) {
      languages.add(language);
    }
  }

  for (const child of node.slice(2)) {
    collectCodeBlockLanguages(child, languages);
  }
}

function normalizeLanguage(value: unknown): string | null {
  return typeof value === 'string' ? value.trim().toLowerCase() || null : null;
}

async function loadLanguage(language: string): Promise<LanguageRegistration[]> {
  const loadBundledLanguage = bundledLanguages[language as BundledLanguage];
  if (!loadBundledLanguage) {
    return [];
  }

  let promise = languageRegistrationPromises.get(language);
  if (!promise) {
    promise = loadBundledLanguage()
      .then((module) => [module.default ?? module].flat() as LanguageRegistration[])
      .catch(() => {
        languageRegistrationPromises.delete(language);
        return [];
      });
    languageRegistrationPromises.set(language, promise);
  }

  return promise;
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
      plugins: markdownPlugins,
    });
    const highlightedMarkdown = await highlightMarkdownCodeBlocks(parsedMarkdown);

    await applyGitHubAutolinks(highlightedMarkdown, {
      repoOwner,
      repoName,
    });

    if (requestId !== renderRequestId.value) {
      return;
    }

    ast.value = highlightedMarkdown;
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
