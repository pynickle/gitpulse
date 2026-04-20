import { readonly, ref } from 'vue';

/**
 * Global modal state management
 * Tracks whether any modal is currently open in the dashboard
 * This allows components like CommentComposer to hide themselves when modals are active
 */

const isAnyModalOpen = ref(false);
const openModalCount = ref(0);

export function useModalState() {
  const openModal = () => {
    openModalCount.value += 1;
    isAnyModalOpen.value = true;
  };

  const closeModal = () => {
    openModalCount.value = Math.max(0, openModalCount.value - 1);
    if (openModalCount.value === 0) {
      isAnyModalOpen.value = false;
    }
  };

  const resetModals = () => {
    openModalCount.value = 0;
    isAnyModalOpen.value = false;
  };

  return {
    /** Whether any modal is currently open */
    isAnyModalOpen: readonly(isAnyModalOpen),
    /** Number of currently open modals (supports nested modals) */
    openModalCount: readonly(openModalCount),
    /** Call when opening a modal */
    openModal,
    /** Call when closing a modal */
    closeModal,
    /** Reset all modal state (e.g., when navigating away) */
    resetModals,
  };
}
