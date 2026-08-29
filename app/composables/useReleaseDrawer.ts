import { computed, shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseDetailPayload } from '#shared/types/releases';

export function useReleaseDrawer() {
  const apiFetch = useGitPulseApiFetch();
  const { t } = useI18n();

  const openItem = shallowRef<TimelineRelease | null>(null);
  const detail = shallowRef<ReleaseDetailPayload | null>(null);
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const requestId = shallowRef(0);

  const isOpen = computed(() => openItem.value !== null);

  const isSameRelease = (left: TimelineRelease, right: TimelineRelease) =>
    left.id === right.id && left.repository.id === right.repository.id;

  const load = async (item: TimelineRelease) => {
    const nextRequestId = requestId.value + 1;
    requestId.value = nextRequestId;
    loading.value = true;
    error.value = null;
    detail.value = null;

    try {
      const payload = await apiFetch<ReleaseDetailPayload>(
        `/api/releases/${item.repository.owner}/${item.repository.name}/${item.id}`
      );
      if (nextRequestId !== requestId.value) return;
      detail.value = payload;
    } catch (err) {
      if (nextRequestId !== requestId.value) return;
      error.value = getFetchErrorMessage(err, t('releaseTimeline.drawerError'));
    } finally {
      if (nextRequestId === requestId.value) {
        loading.value = false;
      }
    }
  };

  const open = (item: TimelineRelease) => {
    const current = openItem.value;
    if (current && isSameRelease(current, item)) return;
    openItem.value = item;
    void load(item);
  };

  const close = () => {
    requestId.value += 1;
    openItem.value = null;
    detail.value = null;
    loading.value = false;
    error.value = null;
  };

  const retry = () => {
    if (openItem.value) void load(openItem.value);
  };

  return {
    openItem,
    detail,
    loading,
    error,
    isOpen,
    open,
    close,
    retry,
  };
}
