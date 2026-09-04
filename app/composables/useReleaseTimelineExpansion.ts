import { shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseDetailPayload } from '#shared/types/releases';

export function useReleaseTimelineExpansion() {
  const apiFetch = useGitPulseApiFetch();
  const { t } = useI18n();

  const expandedBodies = shallowRef(new Map<string, string>());
  const expandingKeys = shallowRef(new Set<string>());
  const expandErrors = shallowRef(new Map<string, string>());

  const keyFor = (item: TimelineRelease) => `${item.repository.id}:${item.id}`;

  const stateFor = (item: TimelineRelease) => {
    const key = keyFor(item);
    return {
      key,
      expandedBody: expandedBodies.value.get(key) ?? null,
      expanding: expandingKeys.value.has(key),
      expandError: expandErrors.value.get(key) ?? null,
    };
  };

  const expand = async (item: TimelineRelease) => {
    const key = keyFor(item);
    if (expandedBodies.value.has(key) || expandingKeys.value.has(key)) {
      return;
    }

    const nextPending = new Set(expandingKeys.value);
    nextPending.add(key);
    expandingKeys.value = nextPending;

    const nextErrors = new Map(expandErrors.value);
    nextErrors.delete(key);
    expandErrors.value = nextErrors;

    try {
      const detail = await apiFetch<ReleaseDetailPayload>(
        `/api/releases/${item.repository.owner}/${item.repository.name}/${item.id}`
      );
      const nextBodies = new Map(expandedBodies.value);
      nextBodies.set(key, detail.body?.trim() ?? '');
      expandedBodies.value = nextBodies;
    } catch (err) {
      const nextFailed = new Map(expandErrors.value);
      nextFailed.set(key, getFetchErrorMessage(err, t('releaseTimeline.expandError')));
      expandErrors.value = nextFailed;
    } finally {
      const nextDone = new Set(expandingKeys.value);
      nextDone.delete(key);
      expandingKeys.value = nextDone;
    }
  };

  return {
    stateFor,
    expand,
  };
}
