import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, onMounted, shallowRef } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { categoryRows, SettingsCategoryNav, svgStub } from './helpers/settings-category-nav';
import { createVueDom } from './helpers/vue-dom';

const OverlayFrame = defineComponent({
  props: [
    'loading',
    'loadingTitle',
    'loadingSubtitle',
    'backLabel',
    'homeLabel',
    'showHomeButton',
    'contentClass',
  ],
  setup:
    (_props, { slots }) =>
    () =>
      h('div', { class: 'frame' }, slots.default?.()),
});

const scrollTops: number[] = [];

const ScrollArea = defineComponent({
  props: ['axis', 'disabled', 'contentClass', 'media'],
  emits: ['scrollElement', 'scroll'],
  setup: (_props, { slots, emit }) => {
    onMounted(() => {
      emit('scrollElement', {
        scrollTo: (options: { top: number }) => scrollTops.push(options.top),
      });
    });

    return () => h('div', { class: 'scroll-area' }, slots.default?.());
  },
});

const FilterDropdown = defineComponent({
  props: ['modelValue', 'options', 'placeholder', 'ariaLabel'],
  emits: ['update:modelValue'],
  setup: () => () => h('div', { class: 'filter-dropdown' }),
});

const FontPickerModal = defineComponent({
  props: ['isVisible', 'title', 'modelValue', 'bundledFonts'],
  emits: ['close', 'update:modelValue'],
  setup: () => () => h('div', { class: 'font-picker' }),
});

const navigationUpdates: Array<Record<string, unknown>> = [];

const createSettingsState = () => ({
  fonts: {
    appFont: 'harmonyos-sans',
    appSystemFont: '',
    codeFont: 'maple-mono',
    codeSystemFont: '',
    prReviewCodeFontSize: 12,
  },
  appearance: { shikiLightTheme: 'github-light', shikiDarkTheme: 'github-dark' },
  composer: {
    conversationDefaultLayout: 'tabbed',
    reviewInlineDefaultLayout: 'tabbed',
    conversationMobileDefaultLayout: 'tabbed',
    reviewInlineMobileDefaultLayout: 'tabbed',
  },
  notificationBehavior: { readMarkMode: 'delayed', readMarkDelaySeconds: 3 },
  navigation: { linkTarget: 'gitpulse', previewSingleLinkedPullRequest: true },
  releaseTimeline: { showReactions: true },
});

const SettingsPage = await compileVue(
  'app/pages/dashboard/settings.vue',
  {
    '@lucide/vue': {
      BellIcon: svgStub,
      CheckIcon: svgStub,
      ChevronLeftIcon: svgStub,
      LayoutPanelLeftIcon: svgStub,
      LinkIcon: svgStub,
      PaletteIcon: svgStub,
      SearchIcon: svgStub,
    },
    '#shared/types/user-settings': {
      COMPOSER_LAYOUT_IDS: ['tabbed', 'split'],
      NOTIFICATION_READ_MARK_DELAY_SECONDS: [3, 5],
      PR_REVIEW_CODE_FONT_SIZES: [12, 14],
    },
    '#shared/utils/user-settings': { normalizeSystemFontFamily: (value: string) => value },
    '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: OverlayFrame },
    '~/components/dashboard/settings/SettingsCategoryNav.vue': { default: SettingsCategoryNav },
    '~/components/ui/FilterDropdown.vue': { default: FilterDropdown },
    '~/components/ui/FontPickerModal.vue': { default: FontPickerModal },
    '~/components/ui/GitHubIcon.vue': { default: svgStub },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/composables/useUserSettings': {
      builtinAppFontOptions: [{ id: 'harmonyos-sans', label: 'HarmonyOS Sans' }],
      builtinCodeFontOptions: [{ id: 'maple-mono', label: 'Maple Mono' }],
      shikiLightThemeOptions: [{ id: 'github-light', label: 'GitHub Light' }],
      shikiDarkThemeOptions: [{ id: 'github-dark', label: 'GitHub Dark' }],
      useUserSettings: () => ({
        settings: shallowRef(createSettingsState()),
        loading: shallowRef(false),
        error: shallowRef(''),
        loadSettings: async () => {},
        updateFonts: async () => {},
        updateAppearance: async () => {},
        updateComposer: async () => {},
        updateNavigation: async (navigation: Record<string, unknown>) => {
          navigationUpdates.push(navigation);
        },
        updateNotificationBehavior: async () => {},
        updateReleaseTimeline: async () => {},
      }),
    },
    '~test/app-autoimports': {
      useI18n: () => ({ t: (key: string) => key }),
      usePageMeta: () => {},
      useNavigationRouting: () => ({
        goBackToPreviousPage: async () => {},
        goToDashboardHome: async () => {},
        shouldShowHomeButton: shallowRef(false),
      }),
    },
  },
  {
    useI18n: '~test/app-autoimports',
    usePageMeta: '~test/app-autoimports',
    useNavigationRouting: '~test/app-autoimports',
    useTemplateRef: 'vue',
  }
);

const APPEARANCE_CONTENT = 'dashboard.settings.appFontSection';
const NOTIFICATIONS_CONTENT = 'dashboard.settings.notificationReadSection';
const NAVIGATION_CONTENT = 'dashboard.settings.linkTargetSection';

let dom: ReturnType<typeof createVueDom>;

const mountPage = async () => {
  const { root } = dom.mount(defineComponent({ setup: () => () => h(SettingsPage) }));
  await nextTick();

  return root;
};

const clickCategory = async (root: ParentNode, index: number) => {
  categoryRows(root)[index]?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await nextTick();
};

// The staged swap resolves over animation frames. Wait for the outcome instead of guessing
// a delay: the assertions that follow are what actually check the result.
const waitUntil = async (predicate: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

const panelText = (root: ParentNode) => root.textContent ?? '';

const currentRows = (root: ParentNode) =>
  categoryRows(root)
    .filter((row) => row.getAttribute('aria-current') === 'page')
    .map((row) => row.textContent ?? '');

beforeEach(() => {
  scrollTops.length = 0;
  navigationUpdates.length = 0;
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

describe('settings category switch', () => {
  test('opens on the first category', async () => {
    const root = await mountPage();

    expect(panelText(root)).toContain(APPEARANCE_CONTENT);
    expect(panelText(root)).not.toContain(NOTIFICATIONS_CONTENT);
  });

  test('holds the outgoing category on screen while it animates away, then shows the picked one', async () => {
    const root = await mountPage();

    await clickCategory(root, 1);

    // The swap is staged, so the panel that is leaving keeps the stage: the two never
    // stack, and the incoming category never pops in over the outgoing one.
    expect(panelText(root)).toContain(APPEARANCE_CONTENT);
    expect(panelText(root)).not.toContain(NOTIFICATIONS_CONTENT);
    expect(root.querySelectorAll('.settings__content')).toHaveLength(1);

    await waitUntil(() => panelText(root).includes(NOTIFICATIONS_CONTENT));

    expect(panelText(root)).not.toContain(APPEARANCE_CONTENT);
    expect(root.querySelectorAll('.settings__content')).toHaveLength(1);
  });

  test('scrolls the incoming category to the top only after the old panel has left', async () => {
    const root = await mountPage();

    await clickCategory(root, 1);

    // The panel still on screen keeps its reading position while it fades away.
    expect(scrollTops).toEqual([]);

    await waitUntil(() => scrollTops.length > 0);

    expect(scrollTops).toEqual([0]);
  });

  test('switches back to a category it has already shown', async () => {
    const root = await mountPage();

    await clickCategory(root, 2);
    await waitUntil(() => panelText(root).includes(NAVIGATION_CONTENT));
    expect(panelText(root)).toContain(NAVIGATION_CONTENT);

    await clickCategory(root, 0);
    await waitUntil(() => panelText(root).includes(APPEARANCE_CONTENT));

    expect(panelText(root)).not.toContain(NAVIGATION_CONTENT);
  });

  test('follows the row the reader picked', async () => {
    const root = await mountPage();

    await clickCategory(root, 2);
    await waitUntil(() => panelText(root).includes(NAVIGATION_CONTENT));

    expect(currentRows(root)).toEqual([
      expect.stringContaining('dashboard.settings.navigationTitle'),
    ]);
    expect(panelText(root)).toContain('dashboard.settings.navigationTitle');
  });

  test('shows the single linked pull request list until the reader turns it off', async () => {
    const root = await mountPage();

    await clickCategory(root, 2);
    await waitUntil(() =>
      panelText(root).includes('dashboard.settings.previewSingleLinkedPullRequestLabel')
    );

    const input = root.querySelector<HTMLInputElement>(
      'input[aria-label="dashboard.settings.previewSingleLinkedPullRequestLabel"]'
    );
    expect(input?.checked).toBe(true);
    if (!input) {
      throw new Error('missing single linked pull request preview toggle');
    }

    input.checked = false;
    // The handler's `instanceof HTMLInputElement` reads this realm, not happy-dom's.
    const previousInputElement = globalThis.HTMLInputElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    globalThis.HTMLInputElement = previousInputElement;
    await nextTick();

    expect(navigationUpdates).toEqual([{ previewSingleLinkedPullRequest: false }]);
  });
});
