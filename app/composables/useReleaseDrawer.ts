import { computed, readonly, ref, shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseDetailPayload, ReleaseListItem } from '#shared/types/releases';

export type DrawerRelease = Pick<TimelineRelease, 'repository' | 'id' | 'tagName'>;

interface DetailState {
  detail: ReleaseDetailPayload | null;
  loading: boolean;
  error: string | null;
}

export function useReleaseDrawer() {
  const apiFetch = useGitPulseApiFetch();
  const { t } = useI18n();

  const openItem = shallowRef<TimelineRelease | null>(null);
  const selectedRelease = shallowRef<DrawerRelease | null>(null);
  const details = ref<Record<number, DetailState>>({});
  const showingList = shallowRef(false);
  const listOpened = shallowRef(false);

  const isOpen = computed(() => openItem.value !== null);

  const isEntryRelease = computed(() => selectedRelease.value?.id === openItem.value?.id);
  const current = computed(() =>
    selectedRelease.value ? details.value[selectedRelease.value.id] : null
  );
  const detail = computed(() => current.value?.detail ?? null);
  const loading = computed(() => current.value?.loading ?? false);
  const error = computed(() => current.value?.error ?? null);

  const load = async (release: DrawerRelease) => {
    // Each opening has its own records. Late responses can only update that opening's cache,
    // never its selected surface or a subsequent opening.
    const records = details.value;
    const cached = records[release.id];
    if (cached?.detail || cached?.loading) return;
    records[release.id] = { detail: null, loading: true, error: null };
    try {
      const payload = await apiFetch<ReleaseDetailPayload>(
        `/api/releases/${release.repository.owner}/${release.repository.name}/${release.id}`
      );
      records[release.id] = { detail: payload, loading: false, error: null };
    } catch (err) {
      records[release.id] = {
        detail: null,
        loading: false,
        error: getFetchErrorMessage(err, t('releaseTimeline.drawerError')),
      };
    }
  };

  const open = (item: TimelineRelease) => {
    const current = openItem.value;
    if (current?.id === item.id && current.repository.id === item.repository.id) return;
    details.value = {};
    openItem.value = item;
    selectedRelease.value = item;
    showingList.value = false;
    listOpened.value = false;
    void load(item);
  };

  const close = () => {
    openItem.value = null;
    selectedRelease.value = null;
    details.value = {};
    showingList.value = false;
    listOpened.value = false;
  };

  const showEntry = () => {
    if (!openItem.value) return;
    selectedRelease.value = openItem.value;
    showingList.value = false;
    void load(openItem.value);
  };
  const selectRelease = (release: ReleaseListItem) => {
    if (!openItem.value) return;
    selectedRelease.value = {
      repository: openItem.value.repository,
      id: release.id,
      tagName: release.tag_name,
    };
    showingList.value = false;
    void load(selectedRelease.value);
  };

  return {
    openItem,
    selectedRelease: readonly(selectedRelease),
    detail,
    loading,
    error,
    isOpen,
    isEntryRelease,
    showingList: readonly(showingList),
    listOpened: readonly(listOpened),
    showList: () => {
      if (!openItem.value) return;
      listOpened.value = true;
      showingList.value = true;
    },
    showEntry,
    selectRelease,
    open,
    close,
    retry: () => {
      if (selectedRelease.value) void load(selectedRelease.value);
    },
  };
}
