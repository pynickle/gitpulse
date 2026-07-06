import { onBeforeUnmount, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

export interface InlineAnchorPosition {
  x: number;
  y: number;
  height: number;
}

interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

interface AutocompletePanelLayoutOptions {
  anchorRect: AnchorRect;
  inlineAnchor?: InlineAnchorPosition | null;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  viewportMargin?: number;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  minHeight?: number;
}

interface UseAutocompletePanelOptions {
  isOpen: MaybeRefOrGetter<boolean>;
  listboxId: MaybeRefOrGetter<string>;
  getAnchor: () => HTMLElement | null | undefined;
  onClose: () => void;
  /** If provided, positions the panel relative to a stable inline text anchor, such as a trigger @. */
  getInlineAnchor?: () => InlineAnchorPosition | null;
  requireInlineAnchor?: boolean;
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

export function getAutocompletePanelStyle(options: AutocompletePanelLayoutOptions) {
  const gap = options.gap ?? DEFAULT_GAP;
  const viewportMargin = options.viewportMargin ?? DEFAULT_VIEWPORT_MARGIN;
  const minWidth = options.minWidth ?? DEFAULT_MIN_WIDTH;
  const maxHeightLimit = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;

  const rect = options.anchorRect;
  const availableWidth = Math.max(options.viewportWidth - viewportMargin * 2, minWidth);
  const cappedAnchorWidth =
    options.maxWidth == null ? rect.width : Math.min(rect.width, options.maxWidth);
  const width = Math.min(Math.max(cappedAnchorWidth, minWidth), availableWidth);
  const preferredLeft = options.inlineAnchor ? options.inlineAnchor.x : rect.left;
  const left = Math.min(
    Math.max(preferredLeft, viewportMargin),
    Math.max(options.viewportWidth - width - viewportMargin, viewportMargin)
  );

  const anchorTop = options.inlineAnchor ? options.inlineAnchor.y : rect.top;
  const anchorBottom = options.inlineAnchor
    ? options.inlineAnchor.y + options.inlineAnchor.height
    : rect.bottom;

  const spaceBelow = options.viewportHeight - anchorBottom - gap - viewportMargin;
  const spaceAbove = anchorTop - gap - viewportMargin;
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
    style.bottom = `${Math.round(options.viewportHeight - anchorTop + gap)}px`;
  } else {
    style.top = `${Math.round(anchorBottom + gap)}px`;
  }

  return style;
}

function isScrollbarPress(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return event.offsetX > target.clientWidth || event.offsetY > target.clientHeight;
}

const arePanelStylesEqual = (a: Record<string, string>, b: Record<string, string>) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

export function useAutocompletePanel(options: UseAutocompletePanelOptions) {
  const panelStyle = shallowRef<Record<string, string>>({});
  let repositionFrame: number | null = null;

  const isOwnPanelTarget = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest('[data-autocomplete-menu-id]')?.getAttribute('data-autocomplete-menu-id') ===
      toValue(options.listboxId);

  const updatePanelPosition = () => {
    if (typeof document === 'undefined') return false;

    const anchor = options.getAnchor();
    if (!anchor) return false;

    const inlineAnchor = options.getInlineAnchor?.();
    if (options.requireInlineAnchor && !inlineAnchor) {
      return false;
    }

    const rect = anchor.getBoundingClientRect();
    const nextStyle = getAutocompletePanelStyle({
      anchorRect: rect,
      inlineAnchor,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      gap: options.gap,
      viewportMargin: options.viewportMargin,
      minWidth: options.minWidth,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      minHeight: options.minHeight,
    });
    if (!arePanelStylesEqual(panelStyle.value, nextStyle)) {
      panelStyle.value = nextStyle;
    }
    return true;
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
