export const TAB_GROUP_SOURCES = ['system', 'github-search'] as const;

export type TabGroupSource = (typeof TAB_GROUP_SOURCES)[number];

export const BUILTIN_TAB_GROUP_ID = 'built-in';
export const DEFAULT_CUSTOM_TAB_GROUP_ID = 'default';

export interface TabGroup {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}
