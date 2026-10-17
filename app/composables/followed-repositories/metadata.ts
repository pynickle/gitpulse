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
  load: () => Promise<FollowedRepositoryMetadataResult>;
  onRenamed?: () => Promise<unknown>;
}) {
  const entries = shallowRef(new Map<string, FollowedRepositoryMetadata>());
  const pending = new Set<string>();
  let accountGeneration = 0;

  const currentIds = () => options.repositories.value.map((repository) => repository.id);

  watch(
    options.login,
    () => {
      accountGeneration += 1;
      pending.clear();
      entries.value = new Map();
    },
    { flush: 'sync' }
  );

  watch(
    () => currentIds().join('\0'),
    () => {
      const retained = new Set(currentIds());
      entries.value = new Map([...entries.value].filter(([id]) => retained.has(id)));
      for (const id of pending) {
        if (!retained.has(id)) pending.delete(id);
      }
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
    for (const id of ids) pending.add(id);

    let result: FollowedRepositoryMetadataResult | null = null;
    try {
      result = await options.load();
    } catch {
      result = null;
    }

    if (account !== accountGeneration) return;

    for (const id of ids) pending.delete(id);
    const retained = new Set(currentIds());
    const next = new Map(entries.value);
    for (const id of ids) {
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

  const retry = (id: string) => request([id]);

  watch(
    [options.enabled, options.login, () => currentIds().join('\0')],
    () => {
      void ensure();
    },
    { immediate: true }
  );

  return { entries: readonly(entries), ensure, retry };
}
