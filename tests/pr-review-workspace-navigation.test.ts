import { describe, expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, ref } from 'vue';

import { useCompactCount } from '../app/composables/useCompactCount';
import { compilePRReviewWorkspace } from './helpers/pr-review-workspace';
import { createVueDom } from './helpers/vue-dom';

const i18n = { useI18n: () => ({ locale: ref('en'), t: (key: string) => key }) };
const { Workspace, navigation } = await compilePRReviewWorkspace(i18n);

const mountWorkspace = async (canGoBack: boolean) => {
  navigation.canGoBack.value = canGoBack;
  navigation.goBackToPreviousPage.mockClear();
  navigation.goToDashboardHome.mockClear();

  const close = mock(() => {});
  const dom = createVueDom({ useI18n: i18n.useI18n, useCompactCount });
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(Workspace, {
          owner: 'acme',
          repo: 'widget',
          pullNumber: 42,
          commitId: 'abc123',
          title: 'Add a widget',
          onClose: close,
        }),
    })
  );
  await nextTick();

  return {
    dom,
    close,
    backButton: () => view.root.querySelector<HTMLElement>('[aria-label="repoFileView.back"]'),
    homeButton: () => view.root.querySelector<HTMLElement>('[aria-label="repoFileView.home"]'),
  };
};

describe('PR review workspace header navigation', () => {
  test('Back returns to the pull request details when there is no navigation history', async () => {
    const workspace = await mountWorkspace(false);
    try {
      workspace.backButton()!.click();
      await nextTick();

      expect(workspace.close).toHaveBeenCalledTimes(1);
      expect(navigation.goBackToPreviousPage).not.toHaveBeenCalled();
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('Back follows the logical history when the workspace was opened from another page', async () => {
    const workspace = await mountWorkspace(true);
    try {
      workspace.backButton()!.click();
      await nextTick();

      expect(navigation.goBackToPreviousPage).toHaveBeenCalledTimes(1);
      expect(workspace.close).not.toHaveBeenCalled();
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('Back and Home are always offered, and Home returns to the dashboard home', async () => {
    for (const canGoBack of [false, true]) {
      const workspace = await mountWorkspace(canGoBack);
      try {
        expect(workspace.backButton()).not.toBeNull();
        expect(workspace.homeButton()).not.toBeNull();

        workspace.homeButton()!.click();
        await nextTick();

        expect(navigation.goToDashboardHome).toHaveBeenCalledTimes(1);
      } finally {
        await workspace.dom.cleanup();
      }
    }
  });
});
