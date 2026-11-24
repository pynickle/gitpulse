import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { resolveIssueTypeColor } from '../app/utils/issueTypeColor';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const modalStubs = { useModalLifecycle };
const ConfirmModal = await compileVue(
  'app/components/dashboard/ConfirmModal.vue',
  {
    '@lucide/vue': {
      CheckIcon: icon,
      CircleExclamationPointIcon: icon,
      LoaderCircleIcon: icon,
      XIcon: icon,
    },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/stubs': modalStubs,
  },
  { useModalLifecycle: 'test/stubs' }
);
const LockReasonModal = await compileVue('app/components/dashboard/issue/LockReasonModal.vue', {
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/ConfirmModal.vue': { default: ConfirmModal },
  '~/utils/issueTypeColor': { resolveIssueTypeColor },
});

let dom: ReturnType<typeof createVueDom>;
afterEach(async () => dom?.cleanup());

test('chooses a lock reason in a named dialog and submits it once while saving', async () => {
  const loading = shallowRef(false);
  const submitted: string[] = [];
  dom = createVueDom();
  dom.mount(
    defineComponent({
      setup: () => () =>
        h(LockReasonModal, {
          isVisible: true,
          loading: loading.value,
          onConfirm(reason: string) {
            submitted.push(reason);
            loading.value = true;
          },
        }),
    })
  );

  const dialog = dom.document.querySelector('[role="dialog"]')!;
  expect(dialog).not.toBeNull();
  const heading = dom.document.getElementById(dialog.getAttribute('aria-labelledby')!);
  expect(heading?.textContent).toBe('issueDetail.lockIssueReason');
  const confirm = Array.from(dialog.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'issueDetail.lockIssue'
  )!;
  const reasons = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  expect(reasons.map((reason) => reason.value)).toEqual([
    'off-topic',
    'too heated',
    'resolved',
    'spam',
  ]);
  expect(confirm.disabled).toBe(true);

  reasons[1]!.click();
  await nextTick();
  expect(confirm.disabled).toBe(false);
  confirm.click();
  await nextTick();
  expect(confirm.textContent).toContain('issueDetail.locking');
  expect(reasons.every((reason) => reason.disabled)).toBe(true);
  confirm.click();
  expect(submitted).toEqual(['too heated']);
});
