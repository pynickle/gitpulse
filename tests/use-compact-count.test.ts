import { afterEach, describe, expect, test } from 'bun:test';

import { ref } from 'vue';

import { useCompactCount } from '../app/composables/useCompactCount';

const originalUseI18n = Object.getOwnPropertyDescriptor(globalThis, 'useI18n');
const locale = ref('en');

const installLocale = (next: string) => {
  locale.value = next;
  Object.assign(globalThis, { useI18n: () => ({ locale }) });
};

afterEach(() => {
  if (originalUseI18n) Object.defineProperty(globalThis, 'useI18n', originalUseI18n);
  else Reflect.deleteProperty(globalThis, 'useI18n');
});

describe('useCompactCount', () => {
  test('renders a count in the locale compact notation', () => {
    installLocale('en');

    const { compact } = useCompactCount();

    expect(compact(5200)).toBe('5.2K');
    expect(compact(52000)).toBe('52K');
  });

  test('uses the Chinese magnitude and keeps counts below it exact', () => {
    installLocale('zh-CN');

    const { compact } = useCompactCount();

    expect(compact(5200)).toBe('5200');
    expect(compact(52000)).toBe('5.2万');
  });

  test('treats a missing or non-finite count as zero', () => {
    installLocale('en');

    const { compact, exact } = useCompactCount();

    expect(compact(undefined)).toBe('0');
    expect(compact(null)).toBe('0');
    expect(compact(Number.NaN)).toBe('0');
    expect(compact(Number.POSITIVE_INFINITY)).toBe('0');
    expect(exact(undefined)).toBe('0');
    expect(exact(Number.NaN)).toBe('0');
  });

  test('gives the exact grouped count for a title', () => {
    installLocale('zh-CN');

    const { exact } = useCompactCount();

    expect(exact(5200)).toBe('5,200');
    expect(exact(0)).toBe('0');
  });
});
