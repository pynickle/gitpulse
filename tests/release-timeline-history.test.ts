import { expect, mock, test } from 'bun:test';

import * as env from '../shared/utils/user-settings-storage-env';
mock.module('#shared/utils/user-settings-storage-env', () => env);
const { createTimelineHistoryService } = await import('../server/utils/timeline-history-utils');
import type { UserSettingsStorageAdapter } from '../server/utils/user-settings-storage-utils';
import type { TimelineHistory } from '../shared/types/timeline-history';

const memoryStorage = (): UserSettingsStorageAdapter<TimelineHistory> => {
  const data = new Map<string, TimelineHistory>();
  let queue = Promise.resolve();
  return {
    read: async (login) => structuredClone(data.get(login) ?? null),
    write: async (login, value) => {
      data.set(login, structuredClone(value));
    },
    update(login, updater) {
      const next = queue.then(async () => {
        const value = await updater(structuredClone(data.get(login) ?? null));
        data.set(login, structuredClone(value));
        return value;
      });
      queue = next.then(
        () => {},
        () => {}
      );
      return next;
    },
  };
};
const record = (id = 1) => ({
  repository: { id: 'R_one', owner: 'octo', name: 'one' },
  id,
  title: 'Release',
  tagName: 'v1',
  publishedAt: '2026-10-10T00:00:00Z',
  changelog: 'Saved summary',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  reactions: [],
  discoveredAt: '2026-10-15T00:00:00Z',
});

test('retains history across service recreation, isolates accounts and permanently handles cleared identities', async () => {
  const storage = memoryStorage();
  const history = createTimelineHistoryService(storage);
  expect(await history.read('octo')).toMatchObject({ baseline: null, records: [], revision: 0 });
  await history.advanceBaseline('octo', '2026-10-15T00:00:00Z');
  await history.merge('octo', [record()]);
  const recreated = createTimelineHistoryService(storage);
  expect((await recreated.read('octo')).records).toHaveLength(1);
  await recreated.clear('octo');
  await history.merge('octo', [record(), record(2)]);
  await history.advanceBaseline('octo', '2026-10-01T00:00:00Z');
  expect(await recreated.read('octo')).toMatchObject({
    baseline: '2026-10-15T00:00:00Z',
    records: [record(2)],
  });
  expect((await recreated.read('other')).records).toEqual([]);
});

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, basename } from 'node:path';

import { createStorage } from 'unstorage';
import fsDriver from 'unstorage/drivers/fs';
const { createNitroUserSettingsStorageAdapter, createUpstashRedisUserSettingsStorageAdapter } =
  await import('../server/utils/user-settings-storage-utils');

test('filesystem history round-trips separately from preferences and serializes clear/merge races', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gitpulse-history-'));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'useStorage');
  const storage = createStorage({ driver: fsDriver({ base: directory }) });
  Object.assign(globalThis, { useStorage: () => storage });
  try {
    const prefs = createNitroUserSettingsStorageAdapter<{ theme: string }>();
    await prefs.write('octo cat', { theme: 'dark' });
    const history = createTimelineHistoryService(
      createNitroUserSettingsStorageAdapter<TimelineHistory>('release-timeline')
    );
    await history.merge(' Octo Cat ', [
      record(),
      { ...record(), repository: { ...record().repository, name: 'renamed' } },
    ]);
    expect((await history.read('octo cat')).records).toHaveLength(1);
    expect(await prefs.read('octo cat')).toEqual({ theme: 'dark' });
    await Promise.all([
      history.clear('OCTO CAT'),
      history.merge('octo cat', [record(), record(2)]),
    ]);
    const reopened = createTimelineHistoryService(
      createNitroUserSettingsStorageAdapter<TimelineHistory>('release-timeline')
    );
    expect((await reopened.read('octo cat')).records.map((item) => item.id)).toEqual([2]);
    expect((await reopened.read('someone-else')).records).toEqual([]);
    await Promise.all([history.merge('octo cat', [record(3)]), reopened.clear('octo cat')]);
    await history.merge('octo cat', [record(2), record(3)]);
    expect((await reopened.read('octo cat')).records).toEqual([]);
    expect(await prefs.read('octo cat')).toEqual({ theme: 'dark' });
    await storage.setItem('collections:release-timeline:users:broken', { records: 'corrupt' });
    await expect(reopened.read('broken')).rejects.toThrow();
  } finally {
    await storage.dispose();
    if (original) Object.defineProperty(globalThis, 'useStorage', original);
    else Reflect.deleteProperty(globalThis, 'useStorage');
    if (dirname(directory) !== tmpdir() || !basename(directory).startsWith('gitpulse-history-'))
      throw new Error('Unexpected temporary path');
    await rm(directory, { recursive: true, force: true });
  }
});

test('Upstash uses canonical account/collection keys, JSON snapshots and atomic updates across adapter recreation', async () => {
  const values = new Map<string, string>();
  const redis = {
    async get<T>(key: string): Promise<T | null> {
      const raw = values.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async set(key: string, value: unknown, options?: { nx?: boolean }) {
      if (options?.nx && values.has(key)) return null;
      values.set(key, JSON.stringify(value));
      return 'OK' as const;
    },
    async eval(_script: string, keys: string[], args: unknown[]) {
      if (JSON.parse(values.get(keys[0]!) ?? 'null') === args[0]) {
        if (keys.length === 2) values.set(keys[1]!, String(args[1]));
        else values.delete(keys[0]!);
        return 1;
      }
      return 0;
    },
  };
  const adapter = () =>
    createUpstashRedisUserSettingsStorageAdapter<TimelineHistory>({
      base: 'gitpulse/test',
      collection: 'release-timeline',
      redis: redis as never,
    });
  const history = createTimelineHistoryService(adapter());
  await history.merge(' Octo Cat ', [record()]);
  expect(values.has('gitpulse:test:collections:release-timeline:users:octo%20cat')).toBe(true);
  const recreated = createTimelineHistoryService(adapter());
  await Promise.all([
    history.clear('octo cat'),
    recreated.merge('octo cat', [record(), record(2)]),
  ]);
  expect((await recreated.read('OCTO CAT')).records.map((item) => item.id)).toEqual([2]);
  await recreated.advanceBaseline('octo cat', '2026-10-15T00:00:00Z');
  await history.advanceBaseline('octo cat', '2026-10-01T00:00:00Z');
  expect((await recreated.read('octo cat')).baseline).toBe('2026-10-15T00:00:00Z');
  values.set('gitpulse:test:collections:release-timeline:users:broken', '{broken');
  await expect(recreated.read('broken')).rejects.toThrow();
});
