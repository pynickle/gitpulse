import {
  nextTick,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  watchPostEffect,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

interface ModalLifecycleOptions {
  open: MaybeRefOrGetter<boolean>;
  panel: Readonly<Ref<HTMLElement | null>>;
  onRequestClose: () => void;
}

interface FocusSession {
  returnTarget: HTMLElement | null;
  capturedFocus: Element | null;
  panel: HTMLElement | null;
  focused: boolean;
  transferred: boolean;
  ownedFocusOnClose: boolean;
}

// Only retain closing sessions until the DOM flush finishes. This is a focus handoff,
// not a modal stack: live overlays keep their own registration and keyboard handling.
const closingSessions = new WeakMap<Document, Set<FocusSession>>();

const isUsableReturnTarget = (target: HTMLElement | null): target is HTMLElement => {
  if (!target?.isConnected || target.matches(':disabled') || target.closest('[hidden], [inert]'))
    return false;
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  }
  return true;
};

export function useModalLifecycle(options: ModalLifecycleOptions) {
  const { openModal, closeModal } = useModalState();
  const focusTrap = createFocusTrapController();
  const session = shallowRef<FocusSession | null>(null);

  const close = () => {
    const closing = session.value;
    if (!closing) return;
    session.value = null;
    closeModal();
    const pending = closingSessions.get(document) ?? new Set<FocusSession>();
    closingSessions.set(document, pending);
    pending.add(closing);
    closing.ownedFocusOnClose = Boolean(closing.panel?.contains(document.activeElement));
    void nextTick(() => {
      pending.delete(closing);
      const activeElement = document.activeElement;
      const focusIsVacant =
        !activeElement || activeElement === document.body || !activeElement.isConnected;
      if (
        closing.ownedFocusOnClose &&
        !closing.transferred &&
        isUsableReturnTarget(closing.returnTarget) &&
        (focusIsVacant || closing.panel?.contains(activeElement))
      )
        closing.returnTarget.focus();
    });
  };

  onMounted(() => {
    watch(
      () => toValue(options.open),
      (open) => {
        if (!open) {
          close();
          return;
        }
        openModal();
        session.value = {
          returnTarget:
            document.activeElement instanceof HTMLElement ? document.activeElement : null,
          capturedFocus: document.activeElement,
          panel: null,
          focused: false,
          transferred: false,
          ownedFocusOnClose: false,
        };
      },
      { immediate: true, flush: 'sync' }
    );
  });
  watchPostEffect(() => {
    const current = session.value;
    if (current && options.panel.value && !current.focused) {
      current.panel = options.panel.value;
      current.focused = true;
      const activeElement = document.activeElement;
      if (
        activeElement &&
        activeElement !== document.body &&
        activeElement !== current.capturedFocus &&
        !current.panel.contains(activeElement)
      )
        return;
      for (const closing of closingSessions.get(document) ?? []) {
        const capturedVacantFocus =
          !current.capturedFocus || current.capturedFocus === document.body;
        if (
          !closing.transferred &&
          (closing.panel?.contains(current.capturedFocus) ||
            (capturedVacantFocus && closing.ownedFocusOnClose))
        ) {
          current.returnTarget = closing.returnTarget;
          closing.transferred = true;
          break;
        }
      }
      focusTrap.focusInitialElement(options.panel.value);
    }
  });
  onScopeDispose(close);

  const handleKeydown = (event: KeyboardEvent) => {
    if (!session.value || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onRequestClose();
    } else if (options.panel.value) {
      focusTrap.trapTabKey(event, options.panel.value);
    }
  };

  return { handleKeydown };
}
