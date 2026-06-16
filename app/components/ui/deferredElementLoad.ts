import { onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

export function useDeferredElementLoad(
  target: Ref<Element | null>,
  shouldDefer: MaybeRefOrGetter<boolean>,
  resetKey: MaybeRefOrGetter<unknown>,
  rootMargin = '800px 0px'
) {
  const shouldLoad = ref(!toValue(shouldDefer));
  let observer: IntersectionObserver | undefined;
  let stopWatcher: (() => void) | undefined;

  const stopObserving = () => {
    observer?.disconnect();
    observer = undefined;
  };

  const load = () => {
    shouldLoad.value = true;
    stopObserving();
  };

  const observe = () => {
    stopObserving();

    if (!toValue(shouldDefer)) {
      shouldLoad.value = true;
      return;
    }

    shouldLoad.value = false;

    if (!target.value) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      load();
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          load();
        }
      },
      { rootMargin }
    );
    observer.observe(target.value);
  };

  onMounted(() => {
    stopWatcher = watch(
      () => [toValue(shouldDefer), toValue(resetKey), target.value] as const,
      observe,
      { immediate: true, flush: 'post' }
    );
  });

  onBeforeUnmount(() => {
    stopWatcher?.();
    stopObserving();
  });

  return shouldLoad;
}
