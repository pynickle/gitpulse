import { describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref } from 'vue';

import { useCompactCount } from '../app/composables/useCompactCount';
import type { PRReviewFile } from '../app/composables/usePRReview';
import { compilePRReviewWorkspace } from './helpers/pr-review-workspace';
import { createVueDom } from './helpers/vue-dom';

const locale = ref('en');
const i18n = {
  useI18n: () => ({
    locale,
    t: (key: string, params?: Record<string, unknown>) =>
      [key, ...Object.values(params ?? {})].join(' '),
  }),
};
const { Workspace, review } = await compilePRReviewWorkspace(i18n);

const changedFile = (filename: string, additions = 1, deletions = 0): PRReviewFile => ({
  filename,
  status: 'modified',
  additions,
  deletions,
  changes: additions + deletions,
});

const mountWorkspace = async (props: Record<string, unknown>, files: PRReviewFile[] = []) => {
  review.files.value = files;
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
          ...props,
        }),
    })
  );
  await nextTick();

  const pill = (modifier: string) =>
    view.root.querySelector<HTMLElement>(`.pr-review-workspace__summary-pill--${modifier}`);

  return { dom, view, pill };
};

describe('PR review workspace summary', () => {
  test('shows the pull request totals in compact form, with the exact count as a title', async () => {
    const workspace = await mountWorkspace(
      { additions: 5200, deletions: 1234, changedFiles: 150 },
      [changedFile('src/a.ts', 1, 1)]
    );
    try {
      const add = workspace.pill('add')!;
      const remove = workspace.pill('delete')!;

      expect(add.textContent?.trim()).toBe('+5.2K');
      expect(add.getAttribute('title')).toBe('5,200');
      expect(remove.textContent?.trim()).toBe('-1.2K');
      expect(remove.getAttribute('title')).toBe('1,234');
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('counts every changed file even before its page has loaded', async () => {
    const workspace = await mountWorkspace({ additions: 10, deletions: 2, changedFiles: 150 }, [
      changedFile('src/a.ts'),
    ]);
    try {
      const filesPill = workspace.view.root.querySelectorAll(
        '.pr-review-workspace__summary-pill'
      )[0]!;

      expect(filesPill.textContent?.trim()).toBe('prReview.filesCount 150');
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('keeps a legitimate zero total instead of borrowing the loaded files', async () => {
    const workspace = await mountWorkspace({ additions: 0, deletions: 0 }, [
      changedFile('src/a.ts', 30, 5),
    ]);
    try {
      expect(workspace.pill('add')!.textContent?.trim()).toBe('+0');
      expect(workspace.pill('delete')!.textContent?.trim()).toBe('-0');
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('falls back to the loaded files while the pull request totals are unknown', async () => {
    const workspace = await mountWorkspace({}, [
      changedFile('src/a.ts', 30, 5),
      changedFile('src/b.ts', 1, 0),
    ]);
    try {
      expect(workspace.pill('add')!.textContent?.trim()).toBe('+31');
      expect(workspace.pill('add')!.getAttribute('title')).toBe('31');
      expect(workspace.pill('delete')!.textContent?.trim()).toBe('-5');
    } finally {
      await workspace.dom.cleanup();
    }
  });
});
