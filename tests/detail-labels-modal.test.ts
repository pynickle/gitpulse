import { afterEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, nextTick } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const icon = defineComponent({ setup: () => () => h('svg') });

const messages: Record<string, string> = {
  'detailLabels.title': 'Labels',
  'detailLabels.edit': 'Edit labels',
  'detailLabels.empty': 'No labels',
  'detailLabels.loading': 'Loading labels',
  'detailLabels.noneAvailable': 'No labels available',
  'detailLabels.cancel': 'Cancel',
  'detailLabels.save': 'Save',
  'detailLabels.saving': 'Saving',
  'detailLabels.updateFailed': 'Could not update labels',
};

const t = (key: string) => {
  const message = messages[key];
  if (!message) throw new Error(`Unexpected i18n key: ${key}`);
  return message;
};

type ApiFetch = (url: string, init: { method: string; body?: unknown }) => Promise<unknown>;

let configuredApiFetch: ApiFetch | null = null;

const stubs = {
  useGitPulseApiFetch: () => {
    if (!configuredApiFetch) throw new Error('useGitPulseApiFetch stub not configured');
    return configuredApiFetch;
  },
  getFetchErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
  getTextColorFromBackground: () => '000000',
};

const DetailLabels = await compileVue(
  'app/components/dashboard/detail/DetailLabels.vue',
  {
    '@lucide/vue': {
      CircleExclamationPointIcon: icon,
      CheckIcon: icon,
      LoaderCircleIcon: icon,
      PencilIcon: icon,
      TagIcon: icon,
      XIcon: icon,
    },
    'vue-i18n': { useI18n: () => ({ t }) },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    'test/stubs': stubs,
  },
  {
    useGitPulseApiFetch: 'test/stubs',
    getFetchErrorMessage: 'test/stubs',
    getTextColorFromBackground: 'test/stubs',
  }
);

const repoInfo = { owner: 'octo', repo: 'app' };

const repoLabels = [
  { id: 1, name: 'bug', color: 'd73a4a', description: 'Something is wrong' },
  { id: 2, name: 'docs', color: '0075ca', description: null },
  { id: 3, name: 'help wanted', color: '008672', description: null },
];

interface FetchCall {
  url: string;
  method: string;
  body?: unknown;
}

interface HarnessOptions {
  labels: { id: number; name: string; color: string }[];
  canEditLabels?: boolean;
  number?: number;
  onUpdateLabels?: (labels: unknown[]) => void;
  apiFetch?: (url: string, options: { method: string; body?: unknown }) => Promise<unknown>;
  getLabels?: (url: string) => Promise<unknown>;
}

let dom: ReturnType<typeof createVueDom>;

function mountLabels(options: HarnessOptions) {
  const calls: FetchCall[] = [];
  const emitted: unknown[] = [];
  const getLabels = options.getLabels ?? (async () => repoLabels as unknown);
  const apiFetch =
    options.apiFetch ??
    (async () => {
      return options.labels;
    });

  dom = createVueDom({
    $fetch: async (url: string, init?: { method?: string }) => {
      calls.push({ url, method: init?.method ?? 'GET' });
      return getLabels(url);
    },
  });

  configuredApiFetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    return apiFetch(url, init);
  };

  const Harness = defineComponent({
    setup: () => () =>
      h(DetailLabels as never, {
        labels: options.labels,
        canEditLabels: options.canEditLabels ?? true,
        repoInfo,
        number: options.number ?? 7,
        'onUpdate:labels': (labels: unknown[]) => {
          emitted.push(labels);
          options.onUpdateLabels?.(labels);
        },
      }),
  });

  const mounted = dom.mount(Harness);
  return {
    mounted,
    calls,
    emitted,
    document: dom.document,
    root: mounted.root,
  };
}

const flush = async () => {
  await nextTick();
  await Promise.resolve();
  await nextTick();
};

// The exit transition runs on animation frames; give it a few to finish.
const settleMotion = () => new Promise((resolve) => setTimeout(resolve, 150));

const queryAll = (document: Document, selector: string) =>
  [...document.querySelectorAll(selector)] as HTMLElement[];

const openEditor = async (document: Document) => {
  const editButton = queryAll(document, 'button').find(
    (button) => button.getAttribute('title') === 'Edit labels'
  );
  expect(editButton).toBeDefined();
  editButton!.click();
  await flush();
  await flush();
};

const rows = (document: Document) => queryAll(document, '.label-row');

const checkboxFor = (document: Document, name: string) => {
  const row = rows(document).find(
    (candidate) => candidate.querySelector('.label-row-name')?.textContent?.trim() === name
  );
  expect(row).toBeDefined();
  return row!.querySelector('input[type="checkbox"]') as HTMLInputElement;
};

const saveButton = (document: Document) =>
  queryAll(document, 'button').find((button) => button.textContent?.trim() === 'Save');

afterEach(async () => {
  configuredApiFetch = null;
  await dom?.cleanup();
});

describe('DetailLabels', () => {
  test('lists the repository labels with the applied ones checked', async () => {
    const view = mountLabels({ labels: [{ id: 1, name: 'bug', color: 'd73a4a' }] });
    await flush();

    await openEditor(view.document);

    expect(view.calls.map((call) => call.url)).toEqual(['/api/repos/octo/app/labels']);
    expect(rows(view.document)).toHaveLength(3);
    expect(checkboxFor(view.document, 'bug').checked).toBe(true);
    expect(checkboxFor(view.document, 'docs').checked).toBe(false);
  });

  test('saves the checked label names and reports the updated labels', async () => {
    const saved = [
      { id: 1, name: 'bug', color: 'd73a4a' },
      { id: 3, name: 'help wanted', color: '008672' },
    ];
    const view = mountLabels({
      labels: [{ id: 1, name: 'bug', color: 'd73a4a' }],
      apiFetch: async () => saved,
    });
    await flush();
    await openEditor(view.document);

    checkboxFor(view.document, 'help wanted').click();
    await flush();
    saveButton(view.document)!.click();
    await flush();
    await flush();

    const mutation = view.calls.find((call) => call.method === 'PUT');
    expect(mutation?.url).toBe('/api/repos/octo/app/issues/7/labels');
    expect(mutation?.body).toEqual({ labels: ['bug', 'help wanted'] });
    expect(view.emitted).toEqual([saved]);

    await settleMotion();
    expect(rows(view.document)).toHaveLength(0);
  });

  test('keeps the editor open and shows the failure instead of reporting labels', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const view = mountLabels({
        labels: [{ id: 1, name: 'bug', color: 'd73a4a' }],
        apiFetch: async () => {
          throw new Error('Labels are read-only');
        },
      });
      await flush();
      await openEditor(view.document);

      saveButton(view.document)!.click();
      await flush();
      await flush();

      expect(view.emitted).toEqual([]);
      expect(queryAll(view.document, '.label-editor-overlay')).toHaveLength(1);
      expect(queryAll(view.document, '.label-editor-error')[0]?.textContent?.trim()).toBe(
        'Labels are read-only'
      );
    } finally {
      console.error = originalError;
    }
  });

  test('does not open the editor without label editing permission', async () => {
    const view = mountLabels({
      labels: [{ id: 1, name: 'bug', color: 'd73a4a' }],
      canEditLabels: false,
    });
    await flush();

    const editButton = queryAll(view.document, 'button').find(
      (button) => button.getAttribute('title') === 'Edit labels'
    );
    expect(editButton?.disabled).toBe(true);
    editButton!.click();
    await flush();

    expect(view.calls).toEqual([]);
    expect(rows(view.document)).toHaveLength(0);
  });
});
