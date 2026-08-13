import type { CSSProperties, MaybeRefOrGetter, Ref } from 'vue';
import { computed, onBeforeUnmount, onMounted, shallowRef, toValue, watch } from 'vue';

export const COMPOSER_BLEED_LAYER_ID = 'gitpulse-composer-bleed-layer';

export function useComposerBleedPosition(options: {
  enabled: MaybeRefOrGetter<boolean>;
  placeholder: Ref<HTMLElement | null>;
  panel: Ref<HTMLElement | null>;
}) {
  const panelHeight = shallowRef(0);
  const panelTop = shallowRef(0);
  const usesLayer = shallowRef(
    import.meta.client && Boolean(document.getElementById(COMPOSER_BLEED_LAYER_ID))
  );

  const bleedStyle = computed<CSSProperties>(() => {
    if (usesLayer.value) {
      return {
        position: 'absolute',
        left: '1.5rem',
        right: '1.5rem',
        top: `${panelTop.value}px`,
        pointerEvents: 'auto',
      };
    }

    return {
      position: 'fixed',
      left: '1.5rem',
      right: '1.5rem',
      top: `${panelTop.value}px`,
      pointerEvents: 'auto',
      zIndex: 10000,
    };
  });

  const syncPosition = () => {
    if (!toValue(options.enabled)) {
      return;
    }

    const placeholder = options.placeholder.value;
    const layer = document.getElementById(COMPOSER_BLEED_LAYER_ID);
    usesLayer.value = Boolean(layer);

    if (!placeholder) {
      return;
    }

    const placeholderRect = placeholder.getBoundingClientRect();
    if (layer) {
      const layerRect = layer.getBoundingClientRect();
      panelTop.value = placeholderRect.top - layerRect.top;
      return;
    }

    panelTop.value = placeholderRect.top;
  };

  const syncPanelHeight = () => {
    const panel = options.panel.value;
    if (!panel) {
      return;
    }

    panelHeight.value = panel.getBoundingClientRect().height;
  };

  onMounted(() => {
    usesLayer.value = Boolean(document.getElementById(COMPOSER_BLEED_LAYER_ID));

    const onScrollOrResize = () => {
      syncPosition();
      syncPanelHeight();
    };

    document.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    const resizeObserver = new ResizeObserver(() => {
      syncPanelHeight();
      syncPosition();
    });

    const stopWatch = watch(
      [() => toValue(options.enabled), options.placeholder, options.panel],
      ([enabled, placeholder, panel], _previous, onCleanup) => {
        if (!enabled) {
          return;
        }

        if (placeholder) {
          resizeObserver.observe(placeholder);
        }
        if (panel) {
          resizeObserver.observe(panel);
        }

        syncPanelHeight();
        syncPosition();

        onCleanup(() => {
          resizeObserver.disconnect();
        });
      },
      { immediate: true, flush: 'post' }
    );

    onBeforeUnmount(() => {
      document.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      resizeObserver.disconnect();
      stopWatch();
    });
  });

  return {
    bleedStyle,
    panelHeight,
    bleedTarget: computed(() => (usesLayer.value ? `#${COMPOSER_BLEED_LAYER_ID}` : 'body')),
  };
}
