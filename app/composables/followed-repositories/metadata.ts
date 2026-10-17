import { onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue';

import type {
  FollowedRepository,
  FollowedRepositoryMetadata,
  FollowedRepositoryMetadataResult,
} from '#shared/types/release-follows';

export function createFollowedRepositoryMetadata(options: {
  login: Readonly<Ref<string | null>>;
  repositories: Readonly<Ref<FollowedRepository[]>>;
  enabled: Readonly<Ref<boolean>>;
  load: (repositories: readonly FollowedRepository[]) => Promise<FollowedRepositoryMetadataResult>;
  onRenamed?: () => Promise<unknown>;
}) {
  const entries = shallowRef(new Map<string, FollowedRepositoryMetadata>());
  const pending = new Set<string>();
  const pendingIds = shallowRef<ReadonlySet<string>>(new Set());
  let accountGeneration = 0;

  const publishPending = () => {
    pendingIds.value = new Set(pending);
  };

  const currentIds = () => options.repositories.value.map((repository) => repository.id);

  watch(
    options.login,
    () => {
      accountGeneration += 1;
      pending.clear();
      publishPending();
      entries.value = new Map();
    },
    { flush: 'sync' }
  );

  watch(
    () => currentIds().join('\0'),
    () => {
      const retained = new Set(currentIds());
      entries.value = new Map([...entries.value].filter(([id]) => retained.has(id)));
      let droppedPending = false;
      for (const id of pending) {
        if (!retained.has(id)) {
          pending.delete(id);
          droppedPending = true;
        }
      }
      if (droppedPending) publishPending();
    },
    { flush: 'sync' }
  );

  onScopeDispose(() => {
    accountGeneration += 1;
    pending.clear();
  });

  const request = async (ids: string[]) => {
    if (ids.length === 0 || !options.login.value) return;
    const account = accountGeneration;
    const requestedIds = new Set(ids);
    const requested = options.repositories.value.filter((repository) =>
      requestedIds.has(repository.id)
    );
    if (requested.length === 0) return;
    for (const repository of requested) pending.add(repository.id);
    publishPending();

    let result: FollowedRepositoryMetadataResult | null = null;
    try {
      result = await options.load(requested);
    } catch {
      result = null;
    }

    if (account !== accountGeneration) return;

    for (const repository of requested) pending.delete(repository.id);
    publishPending();
    const retained = new Set(currentIds());
    const next = new Map(entries.value);
    for (const repository of requested) {
      const id = repository.id;
      if (!retained.has(id)) continue;
      if (!result) {
        const existing = next.get(id);
        if (existing && existing.status !== 'transient') continue;
        next.set(id, { status: 'transient' });
        continue;
      }
      next.set(id, result.repositories[id] ?? { status: 'transient' });
    }
    entries.value = next;

    if (result?.renamed) await options.onRenamed?.();
  };

  const ensure = () => {
    if (!options.enabled.value || !options.login.value) return Promise.resolve();
    const missing = currentIds().filter((id) => !entries.value.has(id) && !pending.has(id));
    return request(missing);
  };

  const retry = (id: string) => {
    if (pending.has(id)) return Promise.resolve();
    return request([id]);
  };

  watch(
    [options.enabled, options.login, () => currentIds().join('\0')],
    () => {
      void ensure();
    },
    { immediate: true }
  );

  return { entries: readonly(entries), pendingIds: readonly(pendingIds), ensure, retry };
}
