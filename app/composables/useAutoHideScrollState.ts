import { onBeforeUnmount, shallowRef } from 'vue';

export default function useAutoHideScrollState(timeoutMs = 1000) {
  const isScrolling = shallowRef(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearScrollTimeout = () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
  };

  const onScroll = () => {
    isScrolling.value = true;
    clearScrollTimeout();
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false;
      scrollTimeout = null;
    }, timeoutMs);
  };

  onBeforeUnmount(clearScrollTimeout);

  return {
    isScrolling,
    onScroll,
  };
}
