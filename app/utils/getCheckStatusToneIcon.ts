import { CheckIcon, DotIcon, XIcon } from '@lucide/vue';

import type { CheckStatusTone } from '#shared/types/pr-checks';

/**
 * One icon per Check Rollup tone, so the Check Status Chip and the merge box
 * checks row read identically: a green check only when nothing is failing or
 * pending, a red cross when any check failed, an amber dot while checks run.
 */
export default function getCheckStatusToneIcon(tone: CheckStatusTone) {
  if (tone === 'danger') return XIcon;
  if (tone === 'warning') return DotIcon;
  return CheckIcon;
}
