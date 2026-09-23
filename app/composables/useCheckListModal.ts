import { computed } from 'vue';

import type { PullRequestCheckRollup } from '#shared/types/pr-checks';
import { toPullRequestChecksView } from '#shared/utils/pr-checks';

/**
 * Single source of truth for the Check List Modal.
 *
 * The Check Status Chip sits on several card surfaces, so the modal state is
 * app-wide rather than per list: a chip click anywhere hands the rollup over, and
 * the modal resolves the same view model the chip reads.
 */
export function useCheckListModal() {
  const activeRollup = useState<PullRequestCheckRollup | null>(
    'gitpulse-check-list-rollup',
    () => null
  );
  const { openModal, closeModal } = useModalState();

  const isVisible = computed(() => activeRollup.value !== null);
  const view = computed(() => toPullRequestChecksView(activeRollup.value));

  const open = (rollup: PullRequestCheckRollup) => {
    activeRollup.value = rollup;
    openModal();
  };

  const close = () => {
    activeRollup.value = null;
    closeModal();
  };

  return { isVisible, view, open, close };
}
