<script setup lang="ts">
import { parseMarkdown } from 'comark';
import type { MarkdownDocument, Node } from 'comark';
import type { highlightCodeBlocks } from 'comark/plugins/highlight';
import security from 'comark/plugins/security';
import type { LanguageRegistration, ThemeRegistration } from 'shiki';
import type { BundledLanguage } from 'shiki/langs';
import type { DefineComponent } from 'vue';
import { computed, provide, shallowRef } from 'vue';

import type { ShikiDarkThemeId, ShikiLightThemeId } from '#shared/types/user-settings';
import MarkdownRendererProseA from '~/components/ui/MarkdownRendererProseA.vue';
import MarkdownRendererProseMedia from '~/components/ui/MarkdownRendererProseMedia.vue';
import MarkdownRendererProseMermaidWrapper from '~/components/ui/MarkdownRendererProseMermaidWrapper.vue';
import useGitHubAutolinks from '~/composables/useGitHubAutolinks';
import { loadShikiTheme, useUserSettings } from '~/composables/useUserSettings';

import { markdownRepoContextKey } from '../../utils/markdownRepoPathUtils';

const props = defineProps<{
  value: string;
  repoOwner?: string;
  repoName?: string;
  basePath?: string;
  branch?: string;
}>();

const ast = shallowRef<MarkdownDocument | null>(null);
const renderRequestId = shallowRef(0);
const { applyGitHubAutolinks } = useGitHubAutolinks();
const { settings } = useUserSettings();
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
    security({
      blockedTags: ['script', 'style', 'iframe', 'object', 'embed'],
      allowedProtocols: ['http', 'https', 'mailto', 'tel'],
      allowDataImages: false,
    }),
  ];
}

const languageRegistrationPromises = new Map<string, Promise<LanguageRegistration[]>>();
let markdownHighlighterRuntimePromise: Promise<MarkdownHighlighterRuntime> | null = null;
let highlightQueue: Promise<void> = Promise.resolve();

interface MarkdownCodeBlockInfo {
  hasHighlightableCodeBlocks: boolean;
  languages: Set<string>;
}

interface MarkdownHighlighterRuntime {
  highlightCodeBlocks: typeof highlightCodeBlocks;
}

interface MarkdownShikiThemeSelection {
  light: ShikiLightThemeId;
  dark: ShikiDarkThemeId;
}

interface MarkdownShikiThemes {
  light: ThemeRegistration;
  dark: ThemeRegistration;
}

type BundledLanguages = (typeof import('shiki/langs'))['bundledLanguages'];

async function highlightMarkdownCodeBlocks(
  tree: MarkdownDocument,
  languageNames: Set<string>,
  themeSelection: MarkdownShikiThemeSelection
): Promise<MarkdownDocument> {
  const [languages, highlighterRuntime, themes] = await Promise.all([
    loadMarkdownLanguages(languageNames),
    loadMarkdownHighlighterRuntime(),
    loadMarkdownShikiThemes(themeSelection),
  ]);

  const highlightedTree = highlightQueue.then(() =>
    highlighterRuntime.highlightCodeBlocks(tree, {
      themes,
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

function loadMarkdownHighlighterRuntime(): Promise<MarkdownHighlighterRuntime> {
  if (!markdownHighlighterRuntimePromise) {
    markdownHighlighterRuntimePromise = import('comark/plugins/highlight').then(
      (highlightModule) => ({
        highlightCodeBlocks: highlightModule.highlightCodeBlocks,
      })
    );
    markdownHighlighterRuntimePromise.catch(() => {
      markdownHighlighterRuntimePromise = null;
    });
  }

  return markdownHighlighterRuntimePromise;
}

function loadMarkdownShikiThemes({
  light,
  dark,
}: MarkdownShikiThemeSelection): Promise<MarkdownShikiThemes> {
  return Promise.all([loadShikiTheme(light), loadShikiTheme(dark)]).then(
    ([lightTheme, darkTheme]) => ({
      light: lightTheme,
      dark: darkTheme,
    })
  );
}

async function loadMarkdownLanguages(languages: Set<string>): Promise<LanguageRegistration[]> {
  if (languages.size === 0) {
    return [];
  }

  const { bundledLanguages } = await import('shiki/langs');
  const modules = await Promise.all(
    [...languages].map((language) => loadLanguage(language, bundledLanguages))
  );

  return modules.flat();
}

function inspectMarkdownCodeBlocks(tree: MarkdownDocument): MarkdownCodeBlockInfo {
  const codeBlockInfo: MarkdownCodeBlockInfo = {
    hasHighlightableCodeBlocks: false,
    languages: new Set<string>(),
  };

  for (const node of tree.nodes) {
    collectCodeBlockInfo(node, codeBlockInfo);
  }

  return codeBlockInfo;
}

function collectCodeBlockInfo(node: Node, codeBlockInfo: MarkdownCodeBlockInfo) {
  if (!Array.isArray(node)) {
    return;
  }

  if (node[0] === 'pre' && Array.isArray(node[2]) && node[2][0] === 'code') {
    const language = normalizeLanguage(node[1].language);
    if (language && language !== 'mermaid') {
      codeBlockInfo.hasHighlightableCodeBlocks = true;
      codeBlockInfo.languages.add(language);
    }
  }

  for (const child of node.slice(2)) {
    if (Array.isArray(child)) {
      collectCodeBlockInfo(child, codeBlockInfo);
    }
  }
}

function normalizeLanguage(value: unknown): string | null {
  return typeof value === 'string' ? value.trim().toLowerCase() || null : null;
}

async function loadLanguage(
  language: string,
  bundledLanguages: BundledLanguages
): Promise<LanguageRegistration[]> {
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
  () => [
    props.value,
    props.repoOwner,
    props.repoName,
    props.basePath,
    props.branch,
    settings.value.appearance.shikiLightTheme,
    settings.value.appearance.shikiDarkTheme,
  ],
  async ([value, repoOwner, repoName, , , shikiLightTheme, shikiDarkTheme]) => {
    const requestId = renderRequestId.value + 1;
    renderRequestId.value = requestId;

    if (!value) {
      ast.value = null;
      return;
    }

    const parsedMarkdown = await parseMarkdown(value, {
      plugins: markdownPlugins,
    });
    const codeBlockInfo = inspectMarkdownCodeBlocks(parsedMarkdown);
    const renderedMarkdown = codeBlockInfo.hasHighlightableCodeBlocks
      ? await highlightMarkdownCodeBlocks(parsedMarkdown, codeBlockInfo.languages, {
          light: shikiLightTheme as ShikiLightThemeId,
          dark: shikiDarkTheme as ShikiDarkThemeId,
        })
      : parsedMarkdown;

    await applyGitHubAutolinks(renderedMarkdown, {
      repoOwner,
      repoName,
    });

    if (requestId !== renderRequestId.value) {
      return;
    }

    ast.value = renderedMarkdown;
  },
  { immediate: true }
);
</script>

<template>
  <MarkdownDocument
    v-if="ast"
    class="markdown-body"
    :value="ast"
    :components="rendererComponents"
  />
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
