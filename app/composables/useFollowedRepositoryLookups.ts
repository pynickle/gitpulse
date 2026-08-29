import { computed, shallowRef } from 'vue';

import type { LookupClassification } from '#shared/types/release-follows';
import { classifyLookups } from '#shared/utils/release-timeline';

const emptyClassification = (): LookupClassification => ({
  availableIds: [],
  unavailableIds: [],
  transientIds: [],
});

export function useFollowedRepositoryLookups() {
  const apiFetch = useGitPulseApiFetch();
  const { settings, loaded, loadSettings } = useUserSettings();
  const classification = useState<LookupClassification>(
    'release-follows-lookup-classification',
    emptyClassification
  );
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);

  const followedRepositories = computed(() => settings.value.followedRepositories ?? []);
  const unavailableIds = computed(() => classification.value.unavailableIds);
  const transientIds = computed(() => classification.value.transientIds);
  const unavailableIdSet = computed(() => new Set(unavailableIds.value));

  const applyClassification = (next: LookupClassification) => {
    classification.value = {
      availableIds: [...next.availableIds],
      unavailableIds: [...next.unavailableIds],
      transientIds: [...next.transientIds],
    };
  };

  const applyLookupIds = (unavailable: string[], transient: string[]) => {
    const unavailableSet = new Set(unavailable);
    const transientSet = new Set(transient);
    applyClassification({
      availableIds: followedRepositories.value
        .map((item) => item.id)
        .filter((id) => !unavailableSet.has(id) && !transientSet.has(id)),
      unavailableIds: unavailable,
      transientIds: transient,
    });
  };

  const fetchIdentities = async () => {
    if (!loaded.value) {
      await loadSettings();
    }

    const follows = followedRepositories.value;
    if (follows.length === 0) {
      applyClassification(emptyClassification());
      error.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const data = await apiFetch<LookupClassification & { renamed?: boolean }>(
        '/api/release-follows/identities'
      );
      applyClassification({
        availableIds: Array.isArray(data.availableIds) ? data.availableIds : [],
        unavailableIds: Array.isArray(data.unavailableIds) ? data.unavailableIds : [],
        transientIds: Array.isArray(data.transientIds) ? data.transientIds : [],
      });
      if (data.renamed) {
        await loadSettings({ force: true });
      }
    } catch (err) {
      applyClassification(classifyLookups(follows, null));
      error.value = getFetchErrorMessage(err, 'An error occurred');
    } finally {
      loading.value = false;
    }
  };

  return {
    unavailableIds,
    transientIds,
    unavailableIdSet,
    applyLookupIds,
    fetchIdentities,
  };
}
