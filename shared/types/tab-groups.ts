export type TabGroupSource = 'system' | 'github-search';

export const BUILTIN_TAB_GROUP_ID = 'built-in';
export const DEFAULT_CUSTOM_TAB_GROUP_ID = 'default';

export interface TabGroup {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}
