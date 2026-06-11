const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getVisibleFocusableElements = (container: HTMLElement) => {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.getAttribute('tabindex') !== '-1' &&
      (element.offsetParent !== null || element.dataset.focusTrapVisible === 'true')
  );
};

export default function createFocusTrapController() {
  let previouslyFocusedElement: HTMLElement | null = null;

  const capturePreviousFocus = () => {
    previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };

  const focusInitialElement = (container: HTMLElement) => {
    const firstFocusableElement = getVisibleFocusableElements(container)[0];
    firstFocusableElement?.focus();
    if (!firstFocusableElement) {
      container.focus();
    }
  };

  const restorePreviousFocus = () => {
    if (previouslyFocusedElement?.isConnected) {
      previouslyFocusedElement.focus();
    }
    previouslyFocusedElement = null;
  };

  const trapTabKey = (event: KeyboardEvent, container: HTMLElement) => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getVisibleFocusableElements(container);
    if (focusableElements.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) {
      return;
    }
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === firstElement || activeElement === container)) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return {
    capturePreviousFocus,
    focusInitialElement,
    restorePreviousFocus,
    trapTabKey,
  };
}
