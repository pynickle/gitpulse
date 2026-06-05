import type { CustomTab } from '#shared/types/custom-search';
import type { TabGroup } from '#shared/types/tab-groups';

export type AppFontId = 'harmonyos-sans' | 'misans-latin' | 'system';
export type CodeFontId = 'maple-mono' | 'jetbrains-mono' | 'system';

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
