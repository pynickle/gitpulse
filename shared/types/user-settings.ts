import type { CustomTab } from '#shared/types/custom-search';
import type { TabGroup } from '#shared/types/tab-groups';

export const APP_FONT_IDS = ['harmonyos-sans', 'misans-latin', 'system'] as const;
export const CODE_FONT_IDS = ['maple-mono', 'jetbrains-mono', 'system'] as const;

export type AppFontId = (typeof APP_FONT_IDS)[number];
export type CodeFontId = (typeof CODE_FONT_IDS)[number];

export interface UserFontSettings {
  appFont: AppFontId;
  codeFont: CodeFontId;
  appSystemFont?: string;
  codeSystemFont?: string;
}

export interface UserSettings {
  version: 1;
  fonts: UserFontSettings;
  tabGroups: TabGroup[];
  customTabs: CustomTab[];
  updatedAt?: string;
}

export interface UserSettingsPatch {
  fonts?: Partial<UserFontSettings>;
  tabGroups?: TabGroup[];
  customTabs?: CustomTab[];
}
