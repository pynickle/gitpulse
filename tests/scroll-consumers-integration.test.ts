import { expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { useAutocompletePanel } from '../app/composables/useAutocompletePanel';
import { useRefreshableView } from '../app/composables/useRefreshableView';
import * as dashboardTargets from '../app/utils/dashboardUrlNavigationUtils';
import getQueryParamValue from '../app/utils/getQueryParamValue';
import parseGitHubRepoPath from '../app/utils/parseGitHubRepoPath';
import createSessionLruCache from '../app/utils/sessionLruCache';
import tokenizeCodeLine from '../app/utils/tokenizeCodeLine';
import * as composerPresentation from '../shared/utils/composer-presentation';
import * as mentions from '../shared/utils/markdown-mentions';
import type { PRReviewDiffRow } from '../shared/utils/pr-review-patch';
import * as reviewPresentation from '../shared/utils/pr-review-workspace-presentation';
import * as pointer from '../shared/utils/unified-diff-pointer';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

// Resolve Nuxt's alias to the real shared module for the production composable.
mock.module('#shared/utils/composer-presentation', () => composerPresentation);
const { useComposerPresentation } = await import('../app/composables/useComposerPresentation');
mock.module('~/utils/getQueryParamValue', () => ({ default: getQueryParamValue }));
mock.module('~/utils/parseGitHubRepoPath', () => ({ default: parseGitHubRepoPath }));
mock.module('~/utils/sessionLruCache', () => ({ default: createSessionLruCache }));
const { useRepoFiles } = await import('../app/composables/useRepoFiles');

const empty = defineComponent({ setup: () => () => h('span') });
const i18n = { useI18n: () => ({ t: (key: string) => key }) };
const Rows = await compileVue('app/components/dashboard/pr/PRReviewVirtualDiffRows.vue', {
  '#shared/utils/pr-review-workspace-presentation': reviewPresentation,
  '#shared/utils/unified-diff-pointer': pointer,
  '~/utils/tokenizeCodeLine': { default: tokenizeCodeLine },
  '~/components/dashboard/pr/PRReviewDiffReviewThreads.vue': { default: empty },
  '~/components/dashboard/pr/PRReviewInlineComment.vue': { default: empty },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
});
const Viewer = await compileVue('app/components/dashboard/pr/PRReviewDiffViewer.vue', {
  '@lucide/vue': { ChevronRightIcon: empty },
  '~/components/dashboard/pr/PRReviewFilePath.vue': { default: empty },
  '~/components/dashboard/pr/PRReviewVirtualDiffRows.vue': { default: Rows },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
});
const Composer = await compileVue('app/components/dashboard/composer/MarkdownComposer.vue', {
  '@lucide/vue': { Columns2Icon: empty, Rows2Icon: empty },
  'vue-i18n': i18n,
  '#shared/utils/composer-presentation': composerPresentation,
  '#shared/utils/markdown-mentions': mentions,
  '~/components/ui/AutocompleteMenu.vue': { default: empty },
  '~/components/ui/MarkdownRenderer.vue': { default: empty },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
});
const FileView = await compileVue('app/components/dashboard/repo-files/RepoFileView.vue', {
  '@lucide/vue': Object.fromEntries(
    [
      'ArrowLeftIcon',
      'CheckIcon',
      'ChevronRightIcon',
      'CopyIcon',
      'DownloadIcon',
      'FileIcon',
      'FolderIcon',
      'HomeIcon',
      'Loader2Icon',
      'PanelLeftCloseIcon',
      'PanelLeftOpenIcon',
      'WrapTextIcon',
    ].map((name) => [name, empty])
  ),
  '~/components/dashboard/FloatingRefreshButton.vue': { default: empty },
  '~/components/dashboard/repo-files/BranchSelector.vue': { default: empty },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '../../../utils/dashboardUrlNavigationUtils': dashboardTargets,
});

test('the production file tree saves its viewport position and restores it when reopened', async () => {
  const dom = createVueDom({
    useI18n: i18n.useI18n,
    useRefreshableView,
    useLocalePath: () => (route: unknown) => route,
    useRouter: () => ({ push: async () => {}, replace: async () => {} }),
    useRoute: () => ({ query: { repo: 'octo/app', path: '' } }),
    useUserSession: () => ({ loggedIn: shallowRef(true), ready: shallowRef(true) }),
    useUserSettings: () => ({
      settings: shallowRef({
        appearance: { shikiLightTheme: 'github-light', shikiDarkTheme: 'github-dark' },
      }),
    }),
    useGitHubLinkRouting: () => ({
      opensGitHubLinks: shallowRef(false),
      openGitHubTarget: async () => {},
    }),
    useNavigationRouting: () => ({ shouldShowHomeButton: shallowRef(false) }),
    useGitPulseApiFetch: () => async () => [],
    useRepoFiles: () => {
      const files = useRepoFiles();
      // Seed the production data interface as Nuxt hydration does; scroll
      // persistence remains entirely in the mounted production view.
      files.currentBranch.value = files.defaultBranch.value = 'main';
      return files;
    },
  });
  const mount = () =>
    dom.mount(defineComponent({ setup: () => () => h(FileView, { owner: 'octo', repo: 'app' }) }));
  const settle = async () => {
    for (let i = 0; i < 6; i++) await nextTick();
  };
  try {
    let view = mount();
    await settle();
    const first = view.root.querySelector<HTMLElement>('.repo-file-view__tree [role="region"]')!;
    first.scrollTop = 240;
    first.dispatchEvent(new dom.window.Event('scroll'));
    view.unmount();
    view = mount();
    await settle();
    const restored = view.root.querySelector<HTMLElement>('.repo-file-view__tree [role="region"]')!;
    expect(restored).not.toBe(first);
    expect(restored.scrollTop).toBe(240);
    expect(view.root.querySelector<HTMLElement>('.repo-file-view__tree')!.scrollTop).toBe(0);
  } finally {
    await dom.cleanup();
  }
});

test('the production composer synchronizes the native writer with its managed preview in both directions', async () => {
  const frames: FrameRequestCallback[] = [];
  const dom = createVueDom({
    useComposerPresentation,
    useAutocompletePanel,
    useGitPulseApiFetch: () => () => Promise.resolve({ items: [] }),
    useUserSettings: () => ({
      settings: shallowRef({ composer: { conversationDefaultLayout: 'split' } }),
    }),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Composer, {
            surface: 'conversation-sticky',
            repoOwner: 'octo',
            repoName: 'app',
            modelValue: 'Draft',
          }),
      })
    );
    await nextTick();
    const writer = view.root.querySelector('textarea')!;
    const preview = view.root.querySelector<HTMLElement>(
      '.markdown-composer__preview [role="region"]'
    )!;
    Object.defineProperty(writer, 'scrollHeight', { value: 1000 });
    Object.defineProperty(preview, 'scrollHeight', { value: 2000 });
    writer.scrollTop = 250;
    writer.dispatchEvent(new dom.window.Event('scroll'));
    expect(preview.scrollTop).toBe(500);
    frames.splice(0).forEach((callback) => callback(0));
    preview.scrollTop = 1200;
    preview.dispatchEvent(new dom.window.Event('scroll'));
    expect(writer.scrollTop).toBe(600);
    expect(view.root.querySelector<HTMLElement>('.markdown-composer__preview')!.scrollTop).toBe(0);
  } finally {
    await dom.cleanup();
  }
});

test('the production Diff Viewer navigates and virtualizes against its viewport, and Unified Diff pans its own horizontal viewport', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const dom = createVueDom({
    useI18n: i18n.useI18n,
    useDashboardUrlNavigation: () => ({
      resolveDashboardUrlTarget: () => null,
      getDashboardUrlRoute: () => null,
      getPreferredDashboardUrlHref: () => '',
    }),
    useGitHubLinkRouting: () => ({ opensGitHubLinks: shallowRef(false) }),
  });
  dom.window.requestAnimationFrame = (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  };
  dom.window.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const flush = async () => {
    for (let i = 0; i < 6; i++) {
      await nextTick();
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((callback) => callback(0));
    }
  };
  const active = shallowRef('first.ts');
  const visible: string[] = [];
  const rows: PRReviewDiffRow[] = Array.from({ length: 500 }, (_, i) => ({
    key: String(i),
    type: 'context',
    content: `const line${i} = true;`,
    oldLineNumber: i + 1,
    newLineNumber: i + 1,
    position: i + 1,
    isCommentable: true,
  }));
  const sections = ['first.ts', 'second.ts'].map((filename) => ({
    file: { filename, status: 'modified', additions: 0, deletions: 0, patch: '@@' },
    rows,
  }));
  const rect = (top: number, height: number) =>
    ({
      top,
      bottom: top + height,
      height,
      width: 400,
      left: 0,
      right: 400,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  let viewport: HTMLElement | null = null;
  const originalRect = Object.getOwnPropertyDescriptor(
    dom.window.HTMLElement.prototype,
    'getBoundingClientRect'
  );
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function () {
      const node = this as unknown as HTMLElement;
      if (node === viewport) return rect(0, 300);
      const section = node.closest('.pr-review-diff-viewer__file-section');
      if (section) {
        const index = [
          ...dom.document.querySelectorAll('.pr-review-diff-viewer__file-section'),
        ].indexOf(section);
        const top = index * 13040 - (viewport?.scrollTop ?? 0);
        if (node.classList.contains('pr-review-diff-viewer__virtual-row')) return rect(top, 26);
        return rect(top + (node.classList.contains('pr-review-diff-viewer__rows') ? 40 : 0), 13000);
      }
      return rect(0, 300);
    },
  });
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(Viewer, {
            repoOwner: 'octo',
            repoName: 'app',
            sections,
            activeFilename: active.value,
            draftComments: [],
            reviewCommentThreads: [],
            activeDraftTarget: null,
            submitting: false,
            diffArrangement: 'unified',
            workspaceMode: 'narrow',
            keyboardInsetPx: 0,
            onVisibleFileChanged: (filename: string) => visible.push(filename),
          }),
      })
    );
    viewport = view.root.querySelector<HTMLElement>(
      '.pr-review-diff-viewer__body [role="region"]'
    )!;
    viewport.scrollTo = (options: ScrollToOptions | number) => {
      if (typeof options === 'object') viewport!.scrollTop = options.top ?? 0;
    };
    await flush();
    expect(view.root.querySelectorAll('[data-row-key]').length).toBeLessThan(100);
    viewport.scrollTop = 4000;
    viewport.dispatchEvent(new dom.window.Event('scroll'));
    await flush();
    expect(view.root.querySelector('[data-row-key="first.ts:150"]')).not.toBeNull();
    active.value = 'second.ts';
    await flush();
    expect(viewport.scrollTop).toBe(13040);
    expect(view.root.querySelector<HTMLElement>('.pr-review-diff-viewer__body')!.scrollTop).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 100));
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new dom.window.Event('scroll'));
    await flush();
    expect(visible.at(-1)).toBe('first.ts');
    const horizontal = view.root.querySelector<HTMLElement>(
      '.pr-review-diff-viewer__rows-scroll [role="region"]'
    )!;
    const code = horizontal.querySelector('.pr-review-diff-viewer__unified-main > code')!;
    const send = (type: string, x: number) => {
      const event = new dom.window.PointerEvent(type, {
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: x,
        clientY: 20,
        bubbles: true,
        cancelable: true,
      });
      (type === 'pointerdown' ? code : dom.document).dispatchEvent(event);
    };
    send('pointerdown', 200);
    send('pointermove', 100);
    send('pointerup', 100);
    expect(horizontal.scrollLeft).toBe(100);
  } finally {
    if (originalRect)
      Object.defineProperty(
        dom.window.HTMLElement.prototype,
        'getBoundingClientRect',
        originalRect
      );
    else Reflect.deleteProperty(dom.window.HTMLElement.prototype, 'getBoundingClientRect');
    await dom.cleanup();
  }
});
