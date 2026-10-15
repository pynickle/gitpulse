import { z } from 'zod';

import type {
  RecoveredRelease,
  TimelineHistory,
  TimelineHistorySnapshot,
} from '#shared/types/timeline-history';

import {
  getUserSettingsStorageAdapter,
  type UserSettingsStorageAdapter,
} from './user-settings-storage-utils';

const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
export const recoveredReleaseSchema = z.object({
  repository: z.object({
    id: z.string().min(1),
    owner: z.string().min(1),
    name: z.string().min(1),
  }),
  id: z.number().int().positive(),
  title: z.string(),
  tagName: z.string(),
  publishedAt: timestamp,
  changelog: z.string().max(500),
  changelogTruncated: z.boolean(),
  assetCount: z.number().int().nonnegative(),
  isPrerelease: z.boolean(),
  isOldestShown: z.boolean(),
  htmlUrl: z.string().nullable(),
  reactions: z.array(
    z.object({
      content: z.enum(['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes']),
      count: z.number(),
      viewerHasReacted: z.boolean(),
      viewerReactionId: z.number().nullable(),
    })
  ),
  discoveredAt: timestamp,
});
const schema = z.object({
  baseline: timestamp.nullable(),
  records: z.array(recoveredReleaseSchema),
  handled: z.array(z.string()),
  revision: z.number().int().nonnegative(),
});
const normalize = (data: unknown): TimelineHistory =>
  data == null ? { baseline: null, records: [], handled: [], revision: 0 } : schema.parse(data);
const key = (record: RecoveredRelease) => `${record.repository.id}:${record.id}`;
const snapshot = ({ handled: _handled, ...data }: TimelineHistory): TimelineHistorySnapshot => data;

export function createTimelineHistoryService(
  storage: UserSettingsStorageAdapter<TimelineHistory> = getUserSettingsStorageAdapter<TimelineHistory>(
    'release-timeline'
  )
) {
  const update = async (login: string, change: (data: TimelineHistory) => void) =>
    snapshot(
      await storage.update(login, (stored) => {
        const data = normalize(stored);
        change(data);
        data.revision += 1;
        return data;
      })
    );
  return {
    read: async (login: string) => snapshot(normalize(await storage.read(login))),
    advanceBaseline: (login: string, baseline: string) =>
      update(login, (data) => {
        timestamp.parse(baseline);
        if (!data.baseline || Date.parse(baseline) > Date.parse(data.baseline))
          data.baseline = baseline;
      }),
    merge: (login: string, records: RecoveredRelease[]) =>
      update(login, (data) => {
        const handled = new Set(data.handled);
        const retained = new Map(data.records.map((record) => [key(record), record]));
        for (const record of records) {
          const validated = recoveredReleaseSchema.parse(record);
          if (!handled.has(key(validated)) && !retained.has(key(validated)))
            retained.set(key(validated), validated);
        }
        data.records = [...retained.values()].sort(
          (a, b) =>
            Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt) || key(a).localeCompare(key(b))
        );
      }),
    clear: (login: string) =>
      update(login, (data) => {
        data.handled = [...new Set([...data.handled, ...data.records.map(key)])];
        data.records = [];
      }),
  };
}
