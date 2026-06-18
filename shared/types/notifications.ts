export type NotificationSubjectKind = 'Issue' | 'PullRequest' | 'Discussion' | 'Release' | string;

export type NotificationSubjectState = 'open' | 'closed' | 'merged';

export type NotificationSubjectStateStatus = 'pending' | 'loaded' | 'error' | 'unavailable';

export interface NotificationLabel {
  name: string;
  color: string;
}

export interface DashboardNotificationSubject {
  title?: string;
  type?: NotificationSubjectKind;
  url?: string;
  number?: number;
  state?: NotificationSubjectState;
  isAnswered?: boolean;
  stateStatus?: NotificationSubjectStateStatus;
  labels?: NotificationLabel[];
  authorLogin?: string;
  authorAvatarUrl?: string;
}

export interface DashboardNotificationRepository {
  full_name?: string;
  url?: string;
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
  type: 'issues' | 'pulls' | 'discussions';
  number: number;
}

export interface NotificationSubjectStateResult {
  key: string;
  title?: string;
  updatedAt?: string;
  state?: NotificationSubjectState;
  isAnswered?: boolean;
  labels?: NotificationLabel[];
  authorLogin?: string;
  authorAvatarUrl?: string;
}
