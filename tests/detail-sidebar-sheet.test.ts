import { expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue';

import { createFocusTrapController } from '../app/utils/createFocusTrapController';
import { filterDetailPeoplePickerCandidates } from '../app/utils/filterDetailPeoplePickerCandidates';
import { resolveDetailSidebarSheetOpen } from '../app/utils/resolveDetailSidebarSheetOpen';
import { resolveReleaseDrawerSheetGesture } from '../app/utils/resolveReleaseDrawerSheetGesture';
import * as detailOverlayPresentation from '../shared/utils/detail-overlay-presentation';
import * as prReviewPresentation from '../shared/utils/pr-review-workspace-presentation';
import { commentModerationComposable } from './helpers/comment-moderation';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

mock.module('#shared/utils/detail-overlay-presentation', () => detailOverlayPresentation);
mock.module('#shared/utils/pr-review-workspace-presentation', () => prReviewPresentation);

const detailOverlayChrome = await import('../app/composables/useDetailOverlayChrome');
const detailSheetDrag = await import('../app/composables/useDetailSheetDrag');

const empty = defineComponent({ setup: () => () => h('span') });
const iconProxy = new Proxy({}, { get: () => empty });
const frame = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});

const DetailSidebarColumn = await compileVue(
  'app/components/dashboard/detail/DetailSidebarColumn.vue',
  {
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/composables/useDetailOverlayChrome': detailOverlayChrome,
    '~/composables/useDetailSheetDrag': detailSheetDrag,
  }
);

const DetailBottomBar = await compileVue('app/components/dashboard/detail/DetailBottomBar.vue', {
  '@lucide/vue': iconProxy,
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/composables/useDetailOverlayChrome': detailOverlayChrome,
});

const DetailPeoplePickerModal = await compileVue(
  'app/components/dashboard/detail/DetailPeoplePickerModal.vue',
  {
    '@lucide/vue': iconProxy,
    '~/components/ui/CollapsibleGroup.vue': { default: frame },
    '~/components/ui/GitHubAvatar.vue': { default: empty },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  }
);

const detailPane = defineComponent({
  props: { detailSidebarHidden: Boolean },
  setup: (props) => () =>
    h('div', { class: 'detail-columns' }, [
      h('div', { class: 'detail-main-column' }, [
        h('button', { class: 'page-control', type: 'button' }, 'page'),
      ]),
      h(
        DetailSidebarColumn as never,
        { hidden: props.detailSidebarHidden },
        {
          default: () => [h('button', { class: 'sheet-control', type: 'button' }, 'sheet')],
        }
      ),
    ]),
});

const load = async () => detailPane;
const loadPaneWithoutSheet = async () =>
  defineComponent({
    setup: () => () => h('div', { class: 'page-control' }, 'review workspace'),
  });

const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '~/composables/useCommentModeration': commentModerationComposable,
  '@lucide/vue': { LoaderCircleIcon: empty },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/detail/DetailBottomBar.vue': { default: DetailBottomBar },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: frame },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
  '~/composables/useDetailOverlayChrome': detailOverlayChrome,
});

const createDom = (
  isDetailSidebarSheetViewport: boolean,
  loadDetail: () => Promise<unknown> = load,
  initialHidden = false
) => {
  const hidden = shallowRef(initialHidden);
  const isAnyModalOpen = shallowRef(false);
  return {
    hidden,
    isAnyModalOpen,
    dom: createVueDom({
      createDashboardDetailPaneLoaders: () => ({
        loadIssueDetail: loadDetail,
        loadPrDetail: loadDetail,
        loadDiscussionDetail: loadDetail,
        loadReleaseDetail: loadDetail,
        loadRepoDetail: loadDetail,
      }),
      useNavigationHistory: () => ({ shouldShowHomeButton: shallowRef(false) }),
      useDetailSidebarState: () => ({
        isDetailSidebarHidden: hidden,
        syncDetailSidebarPane: () => {},
        toggleDetailSidebar: () => {
          hidden.value = !hidden.value;
        },
        closeDetailSidebar: () => {
          hidden.value = true;
        },
      }),
      useDetailSidebarViewport: () => ({
        isDetailSidebarSheetViewport: shallowRef(isDetailSidebarSheetViewport),
      }),
      useCompactCount: () => ({
        compact: (n: number | null | undefined) => String(n ?? 0),
        exact: (n: number | null | undefined) => String(n ?? 0),
      }),
      useModalState: () => ({
        isAnyModalOpen,
        openModal: () => {
          isAnyModalOpen.value = true;
        },
        closeModal: () => {
          isAnyModalOpen.value = false;
        },
      }),
      resolveDetailSidebarSheetOpen,
      resolveReleaseDrawerSheetGesture,
      createFocusTrapController,
      filterDetailPeoplePickerCandidates,
    }),
  };
};

const mountHost = async (dom: ReturnType<typeof createDom>['dom']) => {
  const view = dom.mount(defineComponent({ setup: () => () => h(Host, createProps()) }));
  await Bun.sleep(0);
  await nextTick();
  await nextTick();
  return view;
};

const createProps = () =>
  reactive({
    issue: null,
    pullRequest: { number: 42, title: 'Fix the side panel', state: 'open' },
    discussion: null,
    release: null,
    repository: null,
    issueError: '',
    pullRequestError: '',
    discussionError: '',
    releaseError: '',
    repoError: '',
    isIssueVisible: false,
    isPullRequestVisible: true,
    isDiscussionVisible: false,
    isReleaseVisible: false,
    isRepositoryVisible: false,
    isPullRequestReviewRoute: false,
    issueDetailKey: '',
    pullRequestDetailKey: 'pr-octo-app-42',
    discussionDetailKey: '',
    releaseDetailKey: '',
    repositoryDetailKey: '',
    loadingIssue: false,
    loadingPullRequest: false,
    loadingDiscussion: false,
    loadingRelease: false,
    loadingRepository: false,
    sourceNotification: null,
  });

const dispatchPointer = (
  win: typeof globalThis.window,
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientY: number,
  pointerId = 1
) => {
  target.dispatchEvent(
    new win.PointerEvent(type, {
      pointerId,
      button: 0,
      clientY,
      bubbles: true,
      cancelable: true,
    })
  );
};

test('a narrow viewport teleports the Detail Sidebar sheet with a scrim that closes it on click', async () => {
  const { dom, hidden } = createDom(true, load, false);
  try {
    const view = await mountHost(dom);

    const layer = view.root.querySelector<HTMLElement>(
      `#${detailOverlayChrome.DETAIL_SHEET_LAYER_ID}`
    );
    expect(layer).not.toBeNull();
    const backdrop = layer?.querySelector<HTMLButtonElement>('.detail-sidebar-sheet-backdrop');
    const sheet = layer?.querySelector<HTMLElement>('.detail-sidebar-sheet.detail-sidebar-column');
    expect(backdrop).not.toBeNull();
    expect(sheet).not.toBeNull();
    expect(sheet?.classList.contains('is-open')).toBe(true);

    backdrop!.click();
    await nextTick();
    expect(hidden.value).toBe(true);
    expect(layer?.querySelector('.detail-sidebar-sheet-backdrop')).toBeNull();
  } finally {
    await dom.cleanup();
  }
});

test('a wide viewport leaves the Detail Sidebar inline and ignores outside clicks', async () => {
  const { dom, hidden } = createDom(false, load, false);
  try {
    const view = await mountHost(dom);

    const columns = view.root.querySelector('.detail-columns');
    expect(columns?.querySelector('.detail-sidebar-column')).not.toBeNull();
    expect(view.root.querySelector('.detail-sidebar-sheet-backdrop')).toBeNull();
    expect(view.root.querySelector('.detail-sidebar-sheet')).toBeNull();

    view.root.querySelector<HTMLElement>('.page-control')!.click();
    await nextTick();
    expect(hidden.value).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('downward handle swipe holds under 80px and dismisses at or above 80px', async () => {
  const { dom, hidden } = createDom(true, load, false);
  try {
    const view = await mountHost(dom);
    const handle = view.root.querySelector<HTMLElement>('.detail-sidebar-sheet__handle-bar')!;
    expect(handle).not.toBeNull();

    dispatchPointer(
      dom.window as unknown as Window & typeof globalThis,
      handle,
      'pointerdown',
      100
    );
    dispatchPointer(
      dom.window as unknown as Window & typeof globalThis,
      handle,
      'pointermove',
      140
    );
    dispatchPointer(dom.window as unknown as Window & typeof globalThis, handle, 'pointerup', 140);
    await nextTick();
    expect(hidden.value).toBe(false);

    dispatchPointer(
      dom.window as unknown as Window & typeof globalThis,
      handle,
      'pointerdown',
      100
    );
    dispatchPointer(
      dom.window as unknown as Window & typeof globalThis,
      handle,
      'pointermove',
      190
    );
    dispatchPointer(dom.window as unknown as Window & typeof globalThis, handle, 'pointerup', 190);
    await nextTick();
    expect(hidden.value).toBe(true);
  } finally {
    await dom.cleanup();
  }
});

test('Escape closes the narrow sheet only when no child modal is open', async () => {
  const { dom, hidden, isAnyModalOpen } = createDom(true, load, false);
  try {
    const view = await mountHost(dom);
    const sheet = view.root.querySelector<HTMLElement>('.detail-sidebar-sheet')!;

    isAnyModalOpen.value = true;
    await nextTick();
    sheet.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(hidden.value).toBe(false);

    isAnyModalOpen.value = false;
    await nextTick();
    sheet.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(hidden.value).toBe(true);
  } finally {
    await dom.cleanup();
  }
});

test('clicks inside the sheet leave it open', async () => {
  const { dom, hidden } = createDom(true, load, false);
  try {
    const view = await mountHost(dom);

    view.root.querySelector<HTMLElement>('.sheet-control')!.click();
    await nextTick();
    expect(hidden.value).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('closing the sheet from inside restores focus to the Detail Bottom Bar toggle', async () => {
  const { dom, hidden } = createDom(true, load, false);
  try {
    const view = await mountHost(dom);

    const toggle = view.root.querySelector<HTMLElement>('.detail-bottom-bar__sidebar-toggle')!;
    const sheetControl = view.root.querySelector<HTMLElement>('.sheet-control')!;
    expect(toggle).not.toBeNull();
    sheetControl.focus();
    expect(document.activeElement).toBe(sheetControl);

    hidden.value = true;
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(toggle);
  } finally {
    await dom.cleanup();
  }
});

test('panes without a Detail Sidebar never render a sheet or bottom bar sheet state', async () => {
  const { dom, hidden } = createDom(true, loadPaneWithoutSheet, false);
  try {
    const view = await mountHost(dom);

    view.root.querySelector<HTMLElement>('.page-control')!.click();
    await nextTick();

    expect(view.root.querySelector('.detail-sidebar-sheet')).toBeNull();
    expect(hidden.value).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('Escape in DetailPeoplePickerModal closes the modal once without dismissing the Detail Sidebar sheet', async () => {
  const { dom, hidden } = createDom(true, load, false);
  const isModalVisible = shallowRef(true);
  let modalCloseCount = 0;

  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () => [
          h(Host, createProps()),
          h(DetailPeoplePickerModal as never, {
            isVisible: isModalVisible.value,
            title: 'Request reviewers',
            closeLabel: 'Close',
            searchPlaceholder: 'Filter reviewers',
            searchLabel: 'Filter reviewers',
            loadingLabel: 'Loading',
            emptyLabel: 'Empty',
            cancelLabel: 'Cancel',
            submitLabel: 'Save',
            candidates: [],
            loading: false,
            submitting: false,
            error: '',
            onClose: () => {
              modalCloseCount += 1;
              isModalVisible.value = false;
            },
          }),
        ],
      })
    );
    await Bun.sleep(0);
    await nextTick();
    await nextTick();

    const sheet = view.root.querySelector<HTMLElement>('.detail-sidebar-sheet')!;
    const overlay = dom.document.querySelector<HTMLElement>('.reviewer-modal-overlay')!;
    expect(sheet.classList.contains('is-open')).toBe(true);
    expect(overlay).not.toBeNull();

    // Even when a child modal forgets to toggle isAnyModalOpen and Escape isn't cancelable,
    // closing the modal consumes Escape cleanly and leaves the sheet open.
    overlay.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await nextTick();
    expect(modalCloseCount).toBe(1);
    expect(isModalVisible.value).toBe(false);
    expect(hidden.value).toBe(false);

    // Once the modal is closed, pressing Escape dismisses the sheet itself.
    sheet.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(hidden.value).toBe(true);
  } finally {
    await dom.cleanup();
  }
});
