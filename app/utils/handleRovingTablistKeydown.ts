/**
 * Shared arrow-key handler for roving-tabindex `role="tablist"` pill groups
 * (WAI-ARIA tabs pattern, no wrap-around). Roving tabindex keeps only the
 * active tab reachable via Tab, so without this handler the inactive options
 * are unreachable by keyboard. Selects the target tab and moves DOM focus to
 * it inside the event's tablist.
 */
export default function handleRovingTablistKeydown(
  event: KeyboardEvent,
  options: {
    itemCount: number;
    activeIndex: number;
    onSelect: (index: number) => void;
  }
) {
  const { itemCount, activeIndex, onSelect } = options;
  if (itemCount <= 0) return;

  let targetIndex: number;
  switch (event.key) {
    case 'ArrowRight':
    case 'Right':
      targetIndex = activeIndex + 1;
      break;
    case 'ArrowLeft':
    case 'Left':
      targetIndex = activeIndex - 1;
      break;
    case 'Home':
      targetIndex = 0;
      break;
    case 'End':
      targetIndex = itemCount - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  if (targetIndex < 0 || targetIndex >= itemCount || targetIndex === activeIndex) {
    return;
  }

  onSelect(targetIndex);

  const tablist = event.currentTarget;
  if (!(tablist instanceof HTMLElement)) return;
  tablist.querySelectorAll<HTMLElement>('[role="tab"]')[targetIndex]?.focus();
}
