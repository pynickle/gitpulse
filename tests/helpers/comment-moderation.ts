import { defineComponent, h, ref } from 'vue';

import { useCommentModeration } from '../../app/composables/useCommentModeration';
import { useModalLifecycle } from '../../app/composables/useModalLifecycle';
import * as contract from '../../shared/types/comment-moderation';
import { compileVue } from './compile-vue';
import { ScrollArea } from './scroll-area';

export const commentModerationComposable = { useCommentModeration };

// The real glyphs carry no text, so a stub with an empty span leaves the control's
// own label the only text a test can match on.
export const commentModerationIcons = new Proxy(
  {},
  {
    get: (_target, name: string) => defineComponent({ name, setup: () => () => h('span') }),
  }
);

export async function commentModerationModules() {
  const modules = {
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key, locale: ref('en') }) },
    '@lucide/vue': commentModerationIcons,
    '#shared/types/comment-moderation': contract,
    '~/composables/useCommentModeration': commentModerationComposable,
    '~/composables/useModalLifecycle': { useModalLifecycle },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  };
  const Actions = await compileVue('app/components/dashboard/comments/CommentActions.vue', modules);
  const Body = await compileVue('app/components/dashboard/comments/CommentBody.vue', modules);
  return {
    '@lucide/vue': commentModerationIcons,
    '~/composables/useCommentModeration': commentModerationComposable,
    '~/components/dashboard/comments/CommentActions.vue': { default: Actions },
    '~/components/dashboard/comments/CommentBody.vue': { default: Body },
  };
}
