import { onBeforeUnmount, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

interface UseAutocompletePanelOptions {
  isOpen: MaybeRefOrGetter<boolean>;
  listboxId: MaybeRefOrGetter<string>;
  getAnchor: () => HTMLElement | null | undefined;
  onClose: () => void;
  gap?: number;
  viewportMargin?: number;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  minHeight?: number;
  ignoreScrollbarPress?: boolean;
}

const DEFAULT_GAP = 4;
const DEFAULT_VIEWPORT_MARGIN = 8;
const DEFAULT_MIN_WIDTH = 220;
const DEFAULT_MAX_HEIGHT = 280;
const DEFAULT_MIN_HEIGHT = 120;

function isScrollbarPress(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return event.offsetX > target.clientWidth || event.offsetY > target.clientHeight;
}

export function useAutocompletePanel(options: UseAutocompletePanelOptions) {
  const panelStyle = shallowRef<Record<string, string>>({});
  let repositionFrame: number | null = null;

  const isOwnPanelTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest('[data-autocomplete-menu-id]')?.getAttribute('data-autocomplete-menu-id') ===
      toValue(options.listboxId);

  const updatePanelPosition = () => {
    if (typeof document === 'undefined') return;

    const anchor = options.getAnchor();
    if (!anchor) return;

    const gap = options.gap ?? DEFAULT_GAP;
    const viewportMargin = options.viewportMargin ?? DEFAULT_VIEWPORT_MARGIN;
    const minWidth = options.minWidth ?? DEFAULT_MIN_WIDTH;
    const maxHeightLimit = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
    const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;

    const rect = anchor.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const availableWidth = Math.max(viewportWidth - viewportMargin * 2, minWidth);
    const cappedAnchorWidth =
      options.maxWidth == null ? rect.width : Math.min(rect.width, options.maxWidth);
    const width = Math.min(Math.max(cappedAnchorWidth, minWidth), availableWidth);
    const left = Math.min(
      Math.max(rect.left, viewportMargin),
      Math.max(viewportWidth - width - viewportMargin, viewportMargin)
    );
    const spaceBelow = viewportHeight - rect.bottom - gap - viewportMargin;
    const spaceAbove = rect.top - gap - viewportMargin;
    const openUpward = spaceBelow < minHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(
      maxHeightLimit,
      Math.max(openUpward ? spaceAbove : spaceBelow, minHeight)
    );
    const style: Record<string, string> = {
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      maxHeight: `${Math.round(maxHeight)}px`,
    };

    if (openUpward) {
      style.bottom = `${Math.round(viewportHeight - rect.top + gap)}px`;
    } else {
      style.top = `${Math.round(rect.bottom + gap)}px`;
    }

    panelStyle.value = style;
  };

  const cancelRepositionFrame = () => {
    if (repositionFrame !== null) {
      cancelAnimationFrame(repositionFrame);
      repositionFrame = null;
    }
  };

  const handleViewportChange = () => {
    if (!toValue(options.isOpen) || repositionFrame !== null) return;
    repositionFrame = requestAnimationFrame(() => {
      repositionFrame = null;
      if (toValue(options.isOpen)) {
        updatePanelPosition();
      }
    });
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (!toValue(options.isOpen)) return;
    const target = event.target as Node;
    const anchor = options.getAnchor();
    if (anchor?.contains(target)) return;
    if (isOwnPanelTarget(event.target)) return;
    if ((options.ignoreScrollbarPress ?? true) && isScrollbarPress(event)) return;
    options.onClose();
  };

  const removeListeners = () => {
    if (typeof document === 'undefined') return;

    document.removeEventListener('mousedown', handleClickOutside);
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('scroll', handleViewportChange, true);
  };

  watch(
    () => toValue(options.isOpen),
    (open) => {
      if (!open) {
        removeListeners();
        cancelRepositionFrame();
        return;
      }

      updatePanelPosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('scroll', handleViewportChange, true);
    }
  );

  onBeforeUnmount(() => {
    removeListeners();
    cancelRepositionFrame();
  });

  return {
    isOwnPanelTarget,
    panelStyle,
    updatePanelPosition,
  };
}
