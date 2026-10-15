import type { TimelineRelease } from './release-follows';

export interface RecoveredRelease extends TimelineRelease {
  discoveredAt: string;
}
export interface TimelineHistory {
  baseline: string | null;
  records: RecoveredRelease[];
  handled: string[];
  revision: number;
}
export type TimelineHistorySnapshot = Omit<TimelineHistory, 'handled'>;
export interface TimelineHistoryAdapter {
  read: () => Promise<TimelineHistorySnapshot>;
  merge: (records: RecoveredRelease[]) => Promise<TimelineHistorySnapshot>;
  clear: () => Promise<TimelineHistorySnapshot>;
}
