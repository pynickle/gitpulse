import { mock } from 'bun:test';

import * as comarkVue from '@comark/vue';
import * as icons from '@lucide/vue';
import * as comark from 'comark';
import linkify from 'comark/plugins/linkify';
import security from 'comark/plugins/security';
import * as Vue from 'vue';

import * as deferredElementLoad from '../../app/components/ui/deferredElementLoad';
import * as markdownContext from '../../app/utils/markdownRepoPathUtils';
import * as avatarUrl from '../../shared/utils/github-avatar-url';
import * as colorModeMedia from '../../shared/utils/markdown-color-mode-source-media';
import * as mermaidPreviewHeight from '../../shared/utils/mermaid-preview-height';
import { compileVue } from './compile-vue';

mock.module('#shared/utils/user-settings', () => import('../../shared/utils/user-settings'));
mock.module('#shared/utils/bundled-fonts', () => import('../../shared/utils/bundled-fonts'));
mock.module(
  '#shared/utils/markdown-mentions',
  () => import('../../shared/utils/markdown-mentions')
);
const settings = await import('../../app/composables/useUserSettings');
const autolinks = await import('../../app/composables/useGitHubAutolinks');

// Load production presentation too: the moderation tests observe the real Markdown
// document and avatar, rather than replacing comment content with a test component.
export async function commentPresentationModules() {
  const proseModules = {
    '@lucide/vue': icons,
    '../../utils/markdownRepoPathUtils': markdownContext,
    './deferredElementLoad': deferredElementLoad,
    '#shared/utils/markdown-color-mode-source-media': colorModeMedia,
    '#shared/utils/mermaid-preview-height': mermaidPreviewHeight,
  };
  const Link = await compileVue('app/components/ui/MarkdownRendererProseA.vue', proseModules);
  const Media = await compileVue('app/components/ui/MarkdownRendererProseMedia.vue', proseModules);
  const Code = await compileVue(
    'app/components/ui/MarkdownRendererProseMermaidWrapper.vue',
    proseModules
  );
  const Markdown = await compileVue(
    'app/components/ui/MarkdownRenderer.vue',
    {
      vue: {
        ...Vue,
        resolveComponent: (name: string) =>
          name === 'MarkdownDocument' ? comarkVue.MarkdownDocument : Vue.resolveComponent(name),
      },
      comark,
      '@comark/vue': comarkVue,
      'comark/plugins/linkify': { default: linkify },
      'comark/plugins/security': { default: security },
      '~/components/ui/MarkdownRendererProseA.vue': { default: Link },
      '~/components/ui/MarkdownRendererProseMedia.vue': { default: Media },
      '~/components/ui/MarkdownRendererProseMermaidWrapper.vue': { default: Code },
      '~/composables/useGitHubAutolinks': autolinks,
      '~/composables/useUserSettings': settings,
      '../../utils/markdownRepoPathUtils': markdownContext,
    },
    { watch: 'vue' }
  );
  const Avatar = await compileVue('app/components/ui/GitHubAvatar.vue', {
    vue: {
      ...Vue,
      resolveComponent: (name: string) => (name === 'NuxtImg' ? 'img' : Vue.resolveComponent(name)),
    },
    '@lucide/vue': icons,
    '#shared/utils/github-avatar-url': avatarUrl,
    './deferredElementLoad': deferredElementLoad,
  });
  return {
    '@lucide/vue': icons,
    '~/components/ui/GitHubAvatar.vue': { default: Avatar },
    '~/components/ui/MarkdownRenderer.vue': { default: Markdown },
  };
}
