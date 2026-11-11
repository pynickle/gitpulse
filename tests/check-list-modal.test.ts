import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import * as checks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const i18n = { useI18n: () => ({ t: (key: string) => key }) };
const CheckListRows = await compileVue(
  'app/components/dashboard/pr/CheckListRows.vue',
  { 'test/i18n': i18n },
  { useI18n: 'test/i18n' }
);
const CheckListModal = await compileVue(
  'app/components/dashboard/pr/CheckListModal.vue',
  {
    '@lucide/vue': { XIcon: icon },
    '#shared/utils/pr-checks': checks,
    '~/components/dashboard/pr/CheckListRows.vue': { default: CheckListRows },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/i18n': i18n,
    'test/icons': { getCheckStatusToneIcon: () => icon },
  },
  { useI18n: 'test/i18n', getCheckStatusToneIcon: 'test/icons' }
);

const view = checks.toPullRequestChecksView({
  state: 'SUCCESS',
  contexts: {
    totalCount: 1,
    nodes: [
      {
        name: 'Unit tests',
        conclusion: 'SUCCESS',
        status: 'COMPLETED',
        detailsUrl: 'https://github.com/octo/app/actions/runs/1',
      },
    ],
  },
});

let dom: ReturnType<typeof createVueDom>;

function mountModal(initiallyVisible = false) {
  dom = createVueDom();
  const visible = shallowRef(initiallyVisible);
  let closeCount = 0;
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(CheckListModal, {
          isVisible: visible.value,
          view,
          onClose: () => {
            closeCount++;
            visible.value = false;
          },
        }),
    })
  );
  return { visible, mounted, closeCount: () => closeCount };
}

afterEach(async () => {
  await dom?.cleanup();
});

test('opening the Check List Modal presents its checks in a native modal, including an initially open mount', async () => {
  mountModal(true);
  await nextTick();

  const dialog = dom.document.querySelector('dialog');
  expect(dialog).not.toBeNull();
  expect(dialog!.open).toBe(true);
  expect(dialog!.getAttribute('aria-label')).toBe('dashboard.checks.modalTitle');
  expect(dialog!.querySelector('a')?.textContent?.trim()).toBe('Unit tests');
  expect(dialog!.querySelector('a')?.getAttribute('href')).toBe(
    'https://github.com/octo/app/actions/runs/1'
  );
});

test('a backdrop press closes the modal when native light dismiss is unavailable', async () => {
  const host = mountModal(true);
  await nextTick();
  const dialog = dom.document.querySelector('dialog')!;
  dialog.getBoundingClientRect = () => new dom.window.DOMRect(100, 100, 460, 300);

  for (const type of ['pointerdown', 'pointerup']) {
    dialog.dispatchEvent(new dom.window.PointerEvent(type, { clientX: 20, clientY: 20 }));
  }
  await Bun.sleep(0);
  await nextTick();
  expect(host.visible.value).toBe(false);
  expect(dialog.open).toBe(false);
  expect(host.closeCount()).toBe(1);
});

test('a platform close request keeps the modal present until its fade finishes, then synchronizes visibility once', async () => {
  const host = mountModal(true);
  await nextTick();
  const dialog = dom.document.querySelector('dialog')!;
  let finishFade!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishFade = resolve;
  });
  dialog.getAnimations = () => [{ finished }] as unknown as Animation[];

  dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await nextTick();
  expect(dialog.open).toBe(true);
  expect(host.visible.value).toBe(true);

  finishFade();
  await Bun.sleep(0);
  await nextTick();
  expect(dialog.open).toBe(false);
  expect(host.visible.value).toBe(false);
  expect(host.closeCount()).toBe(1);
});

test('unmounting an open modal closes its native surface and releases caller visibility once', async () => {
  const host = mountModal(true);
  await nextTick();
  const dialog = dom.document.querySelector('dialog')!;

  // Browsers queue close events; happy-dom dispatches them synchronously.
  dialog.close = () => {
    dialog.open = false;
    queueMicrotask(() => dialog.dispatchEvent(new dom.window.Event('close')));
  };

  host.mounted.unmount();
  await nextTick();
  expect(dialog.open).toBe(false);
  expect(host.visible.value).toBe(false);
  expect(host.closeCount()).toBe(1);
});

test('caller visibility opens and closes the modal without emitting an extra close request', async () => {
  const host = mountModal();
  await nextTick();
  const dialog = dom.document.querySelector('dialog')!;
  expect(dialog.open).toBe(false);

  host.visible.value = true;
  await nextTick();
  expect(dialog.open).toBe(true);
  host.visible.value = false;
  await nextTick();
  expect(dialog.open).toBe(false);
  expect(host.closeCount()).toBe(0);

  host.visible.value = true;
  await nextTick();
  dialog.close();
  await nextTick();
  expect(host.visible.value).toBe(false);
  expect(host.closeCount()).toBe(1);
});

test('the visible close button dismisses the modal', async () => {
  const host = mountModal(true);
  await nextTick();
  dom.document.querySelector<HTMLButtonElement>('dialog button')!.click();
  await Bun.sleep(0);
  await nextTick();

  expect(host.visible.value).toBe(false);
  expect(host.closeCount()).toBe(1);
});

test('padding clicks and a selection drag ending on the backdrop leave the modal open', async () => {
  const host = mountModal(true);
  await nextTick();
  const dialog = dom.document.querySelector('dialog')!;
  dialog.getBoundingClientRect = () => new dom.window.DOMRect(100, 100, 460, 300);

  const pointer = (type: string, x: number, y: number) => {
    dialog.dispatchEvent(new dom.window.PointerEvent(type, { clientX: x, clientY: y }));
  };
  pointer('pointerdown', 110, 110);
  pointer('pointerup', 110, 110);
  pointer('pointerdown', 110, 110);
  pointer('pointerup', 20, 20);
  pointer('pointerdown', 20, 20);
  pointer('pointerup', 110, 110);
  await Bun.sleep(0);

  expect(dialog.open).toBe(true);
  expect(host.visible.value).toBe(true);
  expect(host.closeCount()).toBe(0);
});

test('reopening while an earlier close is fading does not close the new opening', async () => {
  const host = mountModal(true);
  await nextTick();
  const dialog = dom.document.querySelector('dialog')!;
  let finishFade!: () => void;
  const finished = new Promise<void>((resolve) => {
    finishFade = resolve;
  });
  dialog.getAnimations = () => [{ finished }] as unknown as Animation[];
  dialog.querySelector('button')!.click();

  host.visible.value = false;
  await nextTick();
  host.visible.value = true;
  await nextTick();
  finishFade();
  await Bun.sleep(0);

  expect(dialog.open).toBe(true);
  expect(host.visible.value).toBe(true);
  expect(host.closeCount()).toBe(0);
});
