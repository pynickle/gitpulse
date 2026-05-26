import { watch } from 'vue';

export interface TabGroup {
  id: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}

export type TabGroupSource = 'system' | 'github-search';

export const BUILTIN_TAB_GROUP_ID = 'built-in';
export const DEFAULT_CUSTOM_TAB_GROUP_ID = 'default';

export interface CreateTabGroupInput {
  id?: string;
  name: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}

export interface UpdateTabGroupInput {
  name?: string;
  parentId?: string | null;
  collapsed?: boolean;
  source?: TabGroupSource;
}

const STORAGE_KEY = 'gitpulse:dashboard:tab-groups';

let hasHydratedStoredGroups = false;

const DEFAULT_TAB_GROUPS: TabGroup[] = [
  {
    id: BUILTIN_TAB_GROUP_ID,
    name: 'Built-in Views',
    parentId: null,
    collapsed: false,
    source: 'system',
  },
  {
    id: DEFAULT_CUSTOM_TAB_GROUP_ID,
    name: 'General',
    parentId: null,
    collapsed: false,
    source: 'github-search',
  },
];

const REQUIRED_BUILTIN_GROUP: TabGroup = {
  id: BUILTIN_TAB_GROUP_ID,
  name: 'Built-in Views',
  parentId: null,
  collapsed: false,
  source: 'system',
};

const cloneGroups = (groups: TabGroup[]) => {
  return groups.map((group) => ({ ...group }));
};

const normalizeGroup = (group: Partial<TabGroup>): TabGroup | null => {
  if (typeof group.id !== 'string' || group.id.length === 0) {
    return null;
  }

  if (typeof group.name !== 'string' || group.name.length === 0) {
    return null;
  }

  return {
    id: group.id,
    name: group.name,
    parentId:
      typeof group.parentId === 'string' && group.parentId.length > 0 ? group.parentId : null,
    collapsed: group.collapsed ?? false,
    source:
      group.source === 'system' || group.source === 'github-search'
        ? group.source
        : 'github-search',
  };
};

const ensureRequiredGroups = (groups: TabGroup[]) => {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const builtinGroup = groupMap.get(BUILTIN_TAB_GROUP_ID);

  if (builtinGroup) {
    groupMap.delete(BUILTIN_TAB_GROUP_ID);
  }

  const resolvedBuiltin = {
    ...(builtinGroup ?? REQUIRED_BUILTIN_GROUP),
    id: BUILTIN_TAB_GROUP_ID,
    name: REQUIRED_BUILTIN_GROUP.name,
    parentId: null,
    source: 'system' as const,
  };

  return [resolvedBuiltin, ...groupMap.values()];
};

const readStoredGroups = (): TabGroup[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const groups = parsed
      .map((entry) => normalizeGroup(entry as Partial<TabGroup>))
      .filter((entry): entry is TabGroup => entry !== null);

    if (groups.length === 0) {
      return null;
    }

    return groups;
  } catch {
    return null;
  }
};

const writeStoredGroups = (groups: TabGroup[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
};

const createGroupId = () => {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export function useTabGroups(initialGroups: TabGroup[] = DEFAULT_TAB_GROUPS) {
  const groups = useState<TabGroup[]>('gitpulse-tab-groups', () => cloneGroups(initialGroups));

  if (import.meta.client && groups.value.length === 0) {
    groups.value = cloneGroups(initialGroups);
  }

  if (import.meta.client && !hasHydratedStoredGroups) {
    const storedGroups = readStoredGroups();
    if (storedGroups) {
      groups.value = ensureRequiredGroups(storedGroups);
    } else {
      groups.value = ensureRequiredGroups(groups.value);
    }
    hasHydratedStoredGroups = true;
  }

  watch(
    groups,
    (nextGroups) => {
      writeStoredGroups(nextGroups);
    },
    { deep: true }
  );

  const getGroupById = (groupId: string) => {
    return groups.value.find((group) => group.id === groupId);
  };

  const createGroup = (input: CreateTabGroupInput) => {
    const id = input.id && input.id.length > 0 ? input.id : createGroupId();

    if (getGroupById(id)) {
      return null;
    }

    const group: TabGroup = {
      id,
      name: input.name,
      parentId: input.parentId ?? null,
      collapsed: input.collapsed ?? false,
      source: input.source ?? 'github-search',
    };

    groups.value = [...groups.value, group];
    return group;
  };

  const updateGroup = (groupId: string, updates: UpdateTabGroupInput) => {
    const target = getGroupById(groupId);
    if (!target) {
      return null;
    }

    if (target.source === 'system') {
      return target;
    }

    const updatedGroup: TabGroup = {
      ...target,
      ...updates,
    };

    groups.value = groups.value.map((group) => {
      if (group.id !== groupId) {
        return group;
      }

      return updatedGroup;
    });

    return updatedGroup;
  };

  const deleteGroup = (groupId: string) => {
    const exists = groups.value.some((group) => group.id === groupId);
    if (!exists || groupId === BUILTIN_TAB_GROUP_ID) {
      return false;
    }

    groups.value = groups.value.filter((group) => group.id !== groupId);
    return true;
  };

  const toggleGroupCollapsed = (groupId: string) => {
    const target = getGroupById(groupId);
    if (!target) {
      return null;
    }

    return updateGroup(groupId, { collapsed: !target.collapsed });
  };

  const setGroupCollapsed = (groupId: string, collapsed: boolean) => {
    return updateGroup(groupId, { collapsed });
  };

  const sortGroups = (compareFn: (a: TabGroup, b: TabGroup) => number) => {
    groups.value = [...groups.value].sort(compareFn);
    return groups.value;
  };

  const reorderGroups = (orderedGroupIds: string[]) => {
    const groupMap = new Map(groups.value.map((group) => [group.id, group]));
    const reordered = orderedGroupIds
      .map((id) => groupMap.get(id))
      .filter((group): group is TabGroup => Boolean(group));

    const leftovers = groups.value.filter((group) => !orderedGroupIds.includes(group.id));
    groups.value = [...reordered, ...leftovers];
    return groups.value;
  };

  const moveGroup = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= groups.value.length) {
      return false;
    }

    if (toIndex < 0 || toIndex >= groups.value.length) {
      return false;
    }

    const next = [...groups.value];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) {
      return false;
    }

    next.splice(toIndex, 0, moved);
    groups.value = next;
    return true;
  };

  const resetGroups = () => {
    groups.value = cloneGroups(initialGroups);
    return groups.value;
  };

  return {
    groups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    sortGroups,
    reorderGroups,
    moveGroup,
    toggleGroupCollapsed,
    setGroupCollapsed,
    resetGroups,
  };
}
