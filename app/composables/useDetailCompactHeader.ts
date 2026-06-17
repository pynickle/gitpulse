import { nextTick, onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue';

interface UseDetailCompactHeaderOptions {
  scrollContainers: Ref<HTMLElement | null>[];
  headerElement: Ref<HTMLElement | null>;
  thresholdSelector?: string;
  offset?: number;
}

export default function useDetailCompactHeader({
  scrollContainers,
  headerElement,
  thresholdSelector,
  offset = 8,
}: UseDetailCompactHeaderOptions) {
  const isCompactHeaderVisible = shallowRef(false);
  let animationFrame: number | null = null;
  let pendingScrollTarget: EventTarget | null = null;

  const findScrollContainer = (target: EventTarget | null) => {
    if (
      typeof HTMLElement !== 'undefined' &&
      target instanceof HTMLElement &&
      scrollContainers.some((container) => container.value === target)
    ) {
      return target;
    }

    return (
      scrollContainers
        .map((container) => container.value)
        .find((container) => container && container.scrollHeight > container.clientHeight + 1) ??
      scrollContainers[0]?.value ??
      null
    );
  };

  const updateVisibility = (target: EventTarget | null = null) => {
    const header = headerElement.value;
    const scrollContainer = findScrollContainer(target);

    if (!header || !scrollContainer) {
      isCompactHeaderVisible.value = false;
      return;
    }

    const thresholdElement = thresholdSelector
      ? header.querySelector<HTMLElement>(thresholdSelector)
      : null;
    const containerRect = scrollContainer.getBoundingClientRect();

    if (thresholdElement) {
      const thresholdRect = thresholdElement.getBoundingClientRect();
      isCompactHeaderVisible.value = thresholdRect.top <= containerRect.top + offset;
      return;
    }

    const headerRect = header.getBoundingClientRect();
    isCompactHeaderVisible.value = headerRect.bottom <= containerRect.top + offset;
  };

  const queueVisibilityUpdate = (target: EventTarget | null = null) => {
    pendingScrollTarget = target ?? pendingScrollTarget;

    if (!import.meta.client) {
      updateVisibility(pendingScrollTarget);
      pendingScrollTarget = null;
      return;
    }

    if (animationFrame !== null) return;

    animationFrame = window.requestAnimationFrame(() => {
      const target = pendingScrollTarget;
      animationFrame = null;
      pendingScrollTarget = null;
      updateVisibility(target);
    });
  };

  const onScroll = (event?: Event) => {
    queueVisibilityUpdate(event?.currentTarget ?? null);
  };

  const reset = () => {
    isCompactHeaderVisible.value = false;
    nextTick(() => queueVisibilityUpdate());
  };

  const onResize = () => queueVisibilityUpdate();

  onMounted(() => {
    queueVisibilityUpdate();
    window.addEventListener('resize', onResize, { passive: true });
  });

  onBeforeUnmount(() => {
    if (animationFrame !== null && import.meta.client) {
      window.cancelAnimationFrame(animationFrame);
    }

    if (import.meta.client) {
      window.removeEventListener('resize', onResize);
    }
  });

  return {
    isCompactHeaderVisible,
    onScroll,
    reset,
  };
}
