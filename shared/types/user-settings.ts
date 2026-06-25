import type { CustomTab } from '#shared/types/custom-search';
import type { DashboardNotification } from '#shared/types/notifications';
import type { TabGroup } from '#shared/types/tab-groups';

export const APP_FONT_IDS = ['harmonyos-sans', 'misans-latin', 'system'] as const;
export const CODE_FONT_IDS = ['maple-mono', 'jetbrains-mono', 'system'] as const;
export const NOTIFICATION_READ_MARK_MODE_IDS = ['delayed', 'immediate', 'manual'] as const;
export const NOTIFICATION_READ_MARK_DELAY_SECONDS = [3, 5, 10, 15, 30, 60] as const;
export const LINK_TARGET_IDS = ['gitpulse', 'github'] as const;
export const SHIKI_LIGHT_THEME_IDS = [
  'github-light',
  'light-plus',
  'min-light',
  'vitesse-light',
  'catppuccin-latte',
  'rose-pine-dawn',
] as const;
export const SHIKI_DARK_THEME_IDS = [
  'github-dark',
  'dark-plus',
  'min-dark',
  'vitesse-dark',
  'catppuccin-mocha',
  'nord',
  'dracula',
  'one-dark-pro',
] as const;

export type AppFontId = (typeof APP_FONT_IDS)[number];
export type CodeFontId = (typeof CODE_FONT_IDS)[number];
export type NotificationReadMarkMode = (typeof NOTIFICATION_READ_MARK_MODE_IDS)[number];
export type NotificationReadMarkDelaySeconds =
  (typeof NOTIFICATION_READ_MARK_DELAY_SECONDS)[number];
export type LinkTargetId = (typeof LINK_TARGET_IDS)[number];
export type ShikiLightThemeId = (typeof SHIKI_LIGHT_THEME_IDS)[number];
export type ShikiDarkThemeId = (typeof SHIKI_DARK_THEME_IDS)[number];
export type ShikiThemeId = ShikiLightThemeId | ShikiDarkThemeId;

export interface UserFontSettings {
  appFont: AppFontId;
  codeFont: CodeFontId;
  appSystemFont?: string;
  codeSystemFont?: string;
}

export interface UserAppearanceSettings {
  shikiLightTheme: ShikiLightThemeId;
  shikiDarkTheme: ShikiDarkThemeId;
}

export interface UserNotificationBehaviorSettings {
  readMarkMode: NotificationReadMarkMode;
  readMarkDelaySeconds: NotificationReadMarkDelaySeconds;
}

export interface UserNavigationSettings {
  linkTarget: LinkTargetId;
}

export interface NotificationTodoItem {
  id: string;
  addedAt: string;
  notification: DashboardNotification;
}

export interface UserSettings {
  version: 1;
  fonts: UserFontSettings;
  appearance: UserAppearanceSettings;
  notificationBehavior: UserNotificationBehaviorSettings;
  navigation: UserNavigationSettings;
  tabGroups: TabGroup[];
  customTabs: CustomTab[];
  notificationTodos: NotificationTodoItem[];
  updatedAt?: string;
}

export interface UserSettingsPatch {
  fonts?: Partial<UserFontSettings>;
  appearance?: Partial<UserAppearanceSettings>;
  notificationBehavior?: Partial<UserNotificationBehaviorSettings>;
  navigation?: Partial<UserNavigationSettings>;
  tabGroups?: TabGroup[];
  customTabs?: CustomTab[];
  notificationTodos?: NotificationTodoItem[];
}
