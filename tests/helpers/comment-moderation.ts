import { ref } from 'vue';

import { useCommentModeration } from '../../app/composables/useCommentModeration';
import { useModalLifecycle } from '../../app/composables/useModalLifecycle';
import * as contract from '../../shared/types/comment-moderation';
import { compileVue } from './compile-vue';

export const commentModerationComposable = { useCommentModeration };

export async function commentModerationModules() {
  const modules = {
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key, locale: ref('en') }) },
    '#shared/types/comment-moderation': contract,
    '~/composables/useCommentModeration': commentModerationComposable,
    '~/composables/useModalLifecycle': { useModalLifecycle },
  };
  const Actions = await compileVue('app/components/dashboard/comments/CommentActions.vue', modules);
  const Body = await compileVue('app/components/dashboard/comments/CommentBody.vue', modules);
  return {
    '~/composables/useCommentModeration': commentModerationComposable,
    '~/components/dashboard/comments/CommentActions.vue': { default: Actions },
    '~/components/dashboard/comments/CommentBody.vue': { default: Body },
  };
}
