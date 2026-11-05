import { afterEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import english from '../i18n/locales/en.json';
import { compileVue } from './helpers/compile-vue';
import { interpolateTranslation } from './helpers/translation';
import { createVueDom } from './helpers/vue-dom';

function translate(key: string, params?: Record<string, unknown>) {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (!node || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[part];
  }, english);
  if (typeof value !== 'string') return key;
  return interpolateTranslation(value, params);
}

const icon = defineComponent({ setup: () => () => h('span') });
const Pagination = await compileVue('app/components/dashboard/DashboardPagination.vue', {
  '@lucide/vue': {
    ChevronLeftIcon: icon,
    ChevronRightIcon: icon,
    ChevronsLeftIcon: icon,
  },
});

interface PaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function flush() {
  for (let step = 0; step < 6; step += 1) {
    await Promise.resolve();
    await nextTick();
  }
}

function harness(initial: PaginationMeta) {
  const pagination = ref(initial);
  const changes: number[] = [];
  const Host = defineComponent({
    setup: () => () =>
      h(Pagination, {
        pagination: pagination.value,
        onChange: (page: number) => changes.push(page),
      }),
  });
  const dom = createVueDom({ useI18n: () => ({ locale: shallowRef('en'), t: translate }) });
  cleanups.push(dom.cleanup);
  dom.mount(Host);

  const compact = () => {
    const root = dom.document.querySelector<HTMLElement>('.dashboard-pagination__compact');
    if (!root) throw new Error('missing compact pagination');
    return root;
  };
  const control = (name: 'first' | 'prev' | 'next') => {
    const element = compact().querySelector<HTMLButtonElement>(
      `.dashboard-pagination__step--${name}`
    );
    if (!element) throw new Error(`missing ${name} control`);
    return element;
  };
  const pageInput = () => {
    const element = compact().querySelector<HTMLInputElement>('.dashboard-pagination__page-input');
    if (!element) throw new Error('missing page input');
    return element;
  };
  const focusPageInput = async () => {
    pageInput().focus();
    await flush();
  };
  const typePage = async (value: string) => {
    const input = pageInput();
    input.value = value;
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await flush();
  };
  const pressPageKey = async (key: string) => {
    pageInput().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }));
    await flush();
  };

  return {
    dom,
    pagination,
    changes,
    compact,
    control,
    pageInput,
    focusPageInput,
    typePage,
    pressPageKey,
  };
}

test('narrow pagination steps pages from the icon controls and shows the current page of the total', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  expect(page.pageInput().value).toBe('5');
  expect(
    page.compact().querySelector('.dashboard-pagination__page-total')?.textContent?.trim()
  ).toBe('10');
  expect(page.control('first').getAttribute('aria-label')).toBe(
    translate('dashboard.pagination.first')
  );
  expect(page.control('prev').getAttribute('aria-label')).toBe(
    translate('dashboard.pagination.previous')
  );
  expect(page.control('next').getAttribute('aria-label')).toBe(
    translate('dashboard.pagination.next')
  );

  page.control('next').click();
  page.control('prev').click();
  page.control('first').click();

  expect(page.changes).toEqual([6, 4, 1]);
});

test('narrow pagination disables the controls that the page bounds rule out', async () => {
  const first = harness({
    page: 1,
    perPage: 30,
    hasPrev: false,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  expect(first.control('first').disabled).toBe(true);
  expect(first.control('prev').disabled).toBe(true);
  expect(first.control('next').disabled).toBe(false);

  const last = harness({
    page: 10,
    perPage: 30,
    hasPrev: true,
    hasNext: false,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  expect(last.control('first').disabled).toBe(false);
  expect(last.control('prev').disabled).toBe(false);
  expect(last.control('next').disabled).toBe(true);
});

test('focusing the page field selects the current page so typing replaces it', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  await page.focusPageInput();
  expect(page.pageInput().selectionStart).toBe(0);
  expect(page.pageInput().selectionEnd).toBe(String(5).length);

  await page.typePage('8');
  await page.pressPageKey('Enter');

  expect(page.changes).toEqual([8]);
});

test('a typed page above the total is clamped to the last page', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  await page.focusPageInput();
  await page.typePage('99');
  await page.pressPageKey('Enter');

  expect(page.changes).toEqual([10]);
  expect(page.pageInput().value).toBe('10');
});

test('leaving the field commits the typed page, while Enter on an empty field keeps the page', async () => {
  const typed = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();
  await typed.focusPageInput();
  await typed.typePage('7');
  typed.pageInput().blur();
  await flush();
  expect(typed.changes).toEqual([7]);

  const empty = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();
  await empty.focusPageInput();
  await empty.typePage('');
  await empty.pressPageKey('Enter');
  expect(empty.changes).toEqual([]);
  expect(empty.pageInput().value).toBe('5');
});

test('Escape abandons a typed page and restores the page in view', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  await page.focusPageInput();
  await page.typePage('9');
  await page.pressPageKey('Escape');

  expect(page.changes).toEqual([]);
  expect(page.pageInput().value).toBe('5');
});

test('the page field follows the page in view when the list changes it', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  page.pagination.value = {
    ...page.pagination.value,
    page: 2,
    hasPrev: true,
    hasNext: true,
  };
  await flush();

  expect(page.pageInput().value).toBe('2');
});

test('entering the page field leaves the control size and contents untouched', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  const field = page.pageInput();
  const width = field.style.width;
  const fieldNodes = page
    .compact()
    .querySelector('.dashboard-pagination__page')!
    .querySelectorAll('*').length;
  const barNodes = page.compact().querySelectorAll('*').length;

  await page.focusPageInput();

  expect(field.style.width).toBe(width);
  expect(
    page.compact().querySelector('.dashboard-pagination__page')!.querySelectorAll('*').length
  ).toBe(fieldNodes);
  expect(page.compact().querySelectorAll('*').length).toBe(barNodes);
});

test('the page field is only as wide as the page number it shows', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 30000,
    totalPages: 1000,
  });
  await flush();

  expect(page.pageInput().style.width).toBe('1ch');

  page.pagination.value = {
    ...page.pagination.value,
    page: 12,
    hasPrev: true,
  };
  await flush();

  expect(page.pageInput().style.width).toBe('2ch');
});

test('the page field keeps letters out and only commits digits', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  await page.focusPageInput();
  await page.typePage('a1b');

  expect(page.pageInput().value).toBe('1');
  expect(page.changes).toEqual([]);

  await page.pressPageKey('Enter');
  expect(page.changes).toEqual([1]);
});

test('an unknown total shows the page number alone', async () => {
  const page = harness({
    page: 7,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: null,
    totalPages: null,
  });
  await flush();

  expect(page.compact().querySelector('.dashboard-pagination__page-total')).toBeNull();
  expect(page.compact().querySelector('.dashboard-pagination__page-divider')).toBeNull();
  expect(page.pageInput().getAttribute('aria-label')).toBe(
    translate('dashboard.pagination.pageNumber')
  );
});

test('the page field names the page and the total for assistive tech', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  expect(page.pageInput().getAttribute('aria-label')).toBe(
    translate('dashboard.pagination.pageOfTotal', { page: 5, total: 10 })
  );
});

test('the whole page control opens the field, not only the digits', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  page.compact().querySelector<HTMLElement>('.dashboard-pagination__page')!.click();
  await flush();

  expect(page.dom.document.activeElement).toBe(page.pageInput());
});

test('stepping from the field navigates once instead of committing the typed page too', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  await page.focusPageInput();
  await page.typePage('9');
  // A browser moves focus on mousedown, before the step button's click.
  page
    .pageInput()
    .dispatchEvent(new page.dom.window.FocusEvent('blur', { relatedTarget: page.control('next') }));
  await flush();
  page.control('next').click();
  await flush();

  expect(page.changes).toEqual([6]);
});

test('clicking the total while the field is open selects the page number again', async () => {
  const page = harness({
    page: 5,
    perPage: 30,
    hasPrev: true,
    hasNext: true,
    totalCount: 300,
    totalPages: 10,
  });
  await flush();

  await page.focusPageInput();
  await page.typePage('9');
  page.compact().querySelector<HTMLElement>('.dashboard-pagination__page-total')!.click();
  await flush();

  expect(page.pageInput().value).toBe('9');
  expect(page.pageInput().selectionStart).toBe(0);
  expect(page.pageInput().selectionEnd).toBe(1);
});
