import { describe, expect, test } from 'bun:test';

import createSessionLruCache from '../app/utils/sessionLruCache';

describe('createSessionLruCache', () => {
  test('returns undefined for missing keys', () => {
    const cache = createSessionLruCache<string>(3);
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.has('missing')).toBe(false);
  });

  test('stores and retrieves values', () => {
    const cache = createSessionLruCache<number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.has('a')).toBe(true);
    expect(cache.size).toBe(1);
  });

  test('evicts the least recently used entry when over capacity', () => {
    const cache = createSessionLruCache<string>(2);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');

    expect(cache.has('a')).toBe(false);
    expect(cache.get('b')).toBe('B');
    expect(cache.get('c')).toBe('C');
    expect(cache.size).toBe(2);
  });

  test('get refreshes recency so a touched entry is not evicted next', () => {
    const cache = createSessionLruCache<string>(2);
    cache.set('a', 'A');
    cache.set('b', 'B');
    // Touch a — b becomes the oldest.
    expect(cache.get('a')).toBe('A');
    cache.set('c', 'C');

    expect(cache.has('b')).toBe(false);
    expect(cache.get('a')).toBe('A');
    expect(cache.get('c')).toBe('C');
  });

  test('set on existing key refreshes recency without growing size', () => {
    const cache = createSessionLruCache<string>(2);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('a', 'A2');
    cache.set('c', 'C');

    expect(cache.has('b')).toBe(false);
    expect(cache.get('a')).toBe('A2');
    expect(cache.get('c')).toBe('C');
  });

  test('delete and clear remove entries', () => {
    const cache = createSessionLruCache<string>(3);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.delete('a');
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(1);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('b')).toBeUndefined();
  });
});
