import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { createVueDom } from './helpers/vue-dom';

// The composable asks the reader's motion preference at module scope; the test's DOM has
// no matchMedia, so stand in a static ref instead of importing the real query module.
mock.module('~/composables/useMediaQuery', () => ({
  usePrefersReducedMotion: () => shallowRef(false),
}));

const swipeGuideUtils = await import('../app/utils/resolveNotificationTodoSwipeGuide');
mock.module('~/utils/resolveNotificationTodoSwipeGuide', () => swipeGuideUtils);

const { useNotificationTodoSwipeGuide } =
  await import('../app/composables/useNotificationTodoSwipeGuide');

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

interface MountOptions {
  narrow?: boolean;
  onTab?: boolean;
  loaded?: boolean;
  targetReady?: boolean;
  addableRowId?: string | null;
}

const mountGuide = (options: MountOptions = {}) => {
  const narrow = shallowRef(options.narrow ?? true);
  const onTab = shallowRef(options.onTab ?? true);
  const loaded = shallowRef(options.loaded ?? true);
  const targetReady = shallowRef(options.targetReady ?? true);
  const addableRowId = shallowRef<string | null>(
    options.addableRowId === undefined ? '101' : options.addableRowId
  );
  const seen = shallowRef<boolean | null>(null);
  const patches: { notificationTodoSwipeSeen?: boolean }[] = [];

  let guide: ReturnType<typeof useNotificationTodoSwipeGuide> | undefined;

  const view = dom.mount(
    defineComponent({
      setup() {
        guide = useNotificationTodoSwipeGuide({
          narrowTouchList: narrow,
          onNotificationsTab: onTab,
          loaded,
          targetReady,
          addableRowId,
          seen,
          updateOnboarding: async (patch) => {
            patches.push(patch);
          },
        });
        return () => h('div');
      },
    })
  );

  return {
    view,
    narrow,
    onTab,
    loaded,
    targetReady,
    addableRowId,
    seen,
    patches,
    guide: () => {
      if (!guide) throw new Error('the guide was not created');
      return guide;
    },
  };
};

describe('useNotificationTodoSwipeGuide', () => {
  test('keeps the guide card away until the saved flag answers', async () => {
    const mounted = mountGuide();
    await nextTick();

    expect(mounted.guide().guideCardVisible.value).toBe(false);
    expect(mounted.patches).toEqual([]);
  });

  test('puts the card up on a first visit and spends the visit', async () => {
    const mounted = mountGuide();
    mounted.seen.value = false;
    await nextTick();

    expect(mounted.guide().guideCardVisible.value).toBe(true);
    expect(mounted.patches).toEqual([{ notificationTodoSwipeSeen: true }]);
  });

  test('a reader who already saw the guide gets neither the card nor a write', async () => {
    const mounted = mountGuide();
    mounted.seen.value = true;
    await nextTick();

    expect(mounted.guide().guideCardVisible.value).toBe(false);
    expect(mounted.patches).toEqual([]);
  });

  test('a wide viewport never shows the card, even before any settings write', async () => {
    const mounted = mountGuide({ narrow: false });
    mounted.seen.value = false;
    await nextTick();

    expect(mounted.guide().guideCardVisible.value).toBe(false);
    expect(mounted.patches).toEqual([]);
  });

  test('waits for the list to settle before the card appears', async () => {
    const mounted = mountGuide({ loaded: false });
    mounted.seen.value = false;
    await nextTick();
    expect(mounted.guide().guideCardVisible.value).toBe(false);

    mounted.loaded.value = true;
    await nextTick();
    expect(mounted.guide().guideCardVisible.value).toBe(true);
  });

  test('the card leaves with the notifications tab and returns with it', async () => {
    const mounted = mountGuide();
    mounted.seen.value = false;
    await nextTick();
    expect(mounted.guide().guideCardVisible.value).toBe(true);

    mounted.onTab.value = false;
    await nextTick();
    expect(mounted.guide().guideCardVisible.value).toBe(false);

    mounted.onTab.value = true;
    await nextTick();
    expect(mounted.guide().guideCardVisible.value).toBe(true);
    // Returning to the list must not spend the first visit a second time.
    expect(mounted.patches).toHaveLength(1);
  });

  test('a dismissed card stays dismissed through later visits in the page load', async () => {
    const mounted = mountGuide();
    mounted.seen.value = false;
    await nextTick();

    mounted.guide().dismissGuideCard();
    await nextTick();
    expect(mounted.guide().guideCardVisible.value).toBe(false);

    mounted.onTab.value = false;
    await nextTick();
    mounted.onTab.value = true;
    await nextTick();

    expect(mounted.guide().guideCardVisible.value).toBe(false);
    expect(mounted.patches).toEqual([{ notificationTodoSwipeSeen: true }]);
  });
});
