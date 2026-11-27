import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import enLocale from '../i18n/locales/en.json';
import * as checks from '../shared/utils/pr-checks';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });
const lookupMessage = (key: string): string => {
  let cursor: unknown = enLocale;
  for (const part of key.split('.')) {
    if (!cursor || typeof cursor !== 'object' || !(part in cursor)) return key;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string' ? cursor : key;
};
const t = (key: string, params?: Record<string, unknown>) =>
  interpolateTranslation(lookupMessage(key), params);
const i18n = { useI18n: () => ({ t, locale: ref('en') }) };
const CheckListRows = await compileVue(
  'app/components/dashboard/pr/CheckListRows.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
    '#shared/utils/pr-checks': checks,
    'test/i18n': i18n,
    'test/relative-time': {
      useRelativeTimeNow: () => shallowRef(Date.parse('2026-11-27T17:00:00Z')),
    },
    'test/duration': { formatDurationFromNow: () => '9 hours ago' },
  },
  {
    useI18n: 'test/i18n',
    useRelativeTimeNow: 'test/relative-time',
    formatDurationFromNow: 'test/duration',
  }
);
const CheckListModal = await compileVue(
  'app/components/dashboard/pr/CheckListModal.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }) as unknown,
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

function mountModal(initiallyVisible = false, customView = view) {
  dom = createVueDom();
  const visible = shallowRef(initiallyVisible);
  let closeCount = 0;
  const mounted = dom.mount(
    defineComponent({
      setup: () => () =>
        h(CheckListModal, {
          isVisible: visible.value,
          view: customView,
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
  expect(dialog!.getAttribute('aria-label')).toBe('Checks');
  expect(dialog!.querySelector('a')?.textContent?.trim()).toBe('Unit tests');
  expect(dialog!.querySelector('a')?.getAttribute('href')).toBe(
    'https://github.com/octo/app/actions/runs/1'
  );
});

test('renders breakdown summary and rich check rows with avatars, durations, skipped titles, and no repeated app-name column', async () => {
  const richView = checks.toPullRequestChecksView({
    state: 'SUCCESS',
    contexts: {
      totalCount: 3,
      nodes: [
        {
          __typename: 'CheckRun',
          name: 'Build and test',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          detailsUrl: 'https://github.com/octo/app/runs/1',
          startedAt: '2026-11-27T08:00:00Z',
          completedAt: '2026-11-27T08:01:36Z',
          checkSuite: {
            app: {
              name: 'GitHub Actions',
              logoUrl: 'https://avatars.githubusercontent.com/in/15368',
            },
          },
        },
        {
          __typename: 'CheckRun',
          name: 'Lint',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          startedAt: '2026-11-27T08:00:00Z',
          completedAt: '2026-11-27T08:00:42Z',
          checkSuite: { app: { name: 'GitHub Actions', logoUrl: null } },
        },
        {
          __typename: 'CheckRun',
          name: 'Sourcery review',
          status: 'COMPLETED',
          conclusion: 'SKIPPED',
          startedAt: '2026-11-27T08:00:00Z',
          completedAt: '2026-11-27T08:00:00Z',
          title: '⏭️ Auto re-review limit reached',
          checkSuite: {
            app: {
              name: 'Sourcery',
              logoUrl: 'https://avatars.githubusercontent.com/in/sourcery',
            },
          },
        },
      ],
    },
  });

  mountModal(true, richView);
  await nextTick();

  const dialog = dom.document.querySelector('dialog')!;
  expect(dialog.querySelector('.check-list-modal__summary')?.textContent?.trim()).toBe(
    '2 successful, 1 skipped'
  );
  // Repeated app-name text column is gone; app name lives on avatar tooltips instead.
  expect(dialog.querySelector('.check-list__app')).toBeNull();
  expect(dialog.querySelector('.check-list__dot')).toBeNull();

  const rows = [...dialog.querySelectorAll('.check-list__row')];
  expect(rows).toHaveLength(3);

  const buildRow = rows.find((row) => row.textContent?.includes('Build and test'))!;
  expect(buildRow.querySelector('.check-list__status-icon')?.getAttribute('data-kind')).toBe(
    'success'
  );
  expect(buildRow.querySelector('img.check-list__avatar-img')?.getAttribute('src')).toBe(
    'https://avatars.githubusercontent.com/in/15368'
  );
  expect(buildRow.querySelector('img.check-list__avatar-img')?.getAttribute('title')).toBe(
    'GitHub Actions'
  );
  expect(buildRow.textContent).toContain('Successful in 1m 36s');

  const sourceryRow = rows.find((row) => row.textContent?.includes('Sourcery review'))!;
  expect(sourceryRow.querySelector('.check-list__status-icon')?.getAttribute('data-kind')).toBe(
    'skipped'
  );
  expect(sourceryRow.textContent).toContain('Skipped 9 hours ago');
  expect(sourceryRow.textContent).toContain('⏭️ Auto re-review limit reached');
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
