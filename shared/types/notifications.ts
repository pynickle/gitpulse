export type NotificationSubjectKind = 'Issue' | 'PullRequest' | 'Discussion' | 'Release' | string;

export type NotificationSubjectState = 'open' | 'closed' | 'merged';

export type NotificationSubjectStateStatus = 'pending' | 'loaded' | 'error' | 'unavailable';

export interface DashboardNotificationSubject {
  title?: string;
  type?: NotificationSubjectKind;
  url?: string;
  number?: number;
  state?: NotificationSubjectState;
  stateStatus?: NotificationSubjectStateStatus;
}

export interface DashboardNotificationRepository {
  full_name?: string;
  owner?: {
    avatar_url?: string;
    login?: string;
  };
}

export interface DashboardNotification {
  id: PropertyKey;
  subject?: DashboardNotificationSubject;
  repository?: DashboardNotificationRepository;
  unread?: boolean;
  updated_at?: string;
  reason?: string;
  html_url?: string;
  [key: string]: unknown;
}

export interface NotificationSubjectStateTarget {
  key: string;
  owner: string;
  repo: string;
  type: 'issues' | 'pulls';
  number: number;
}

export interface NotificationSubjectStateResult {
  key: string;
  state?: NotificationSubjectState;
}
