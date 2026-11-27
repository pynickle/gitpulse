import type { PullRequestStack, PullRequestStackLayerState } from '#shared/types/pulls';

export function isActiveStackLayerState(state: PullRequestStackLayerState): boolean {
  return state === 'open' || state === 'draft';
}

export function findCurrentStackLayerIndex(
  stack: PullRequestStack,
  currentPullNumber?: number
): number {
  if (!stack.layers.length) return -1;
  if (currentPullNumber !== undefined) {
    const byNumber = stack.layers.findIndex((layer) => layer.number === currentPullNumber);
    if (byNumber >= 0) return byNumber;
  }
  return Math.min(stack.place, stack.layers.length) - 1;
}

/**
 * True when this pull request is the only remaining active (open or draft) Layer in
 * its Stack, all lower Layers are already merged, no active Layers sit above it,
 * and it directly targets the Stack's Trunk (ADR 0056).
 *
 * Such a Layer keeps the Stack row for context while regaining standard Branch
 * Currency, Branch Update, and single-PR merge.
 */
export function isSoleActiveStackLayer(
  stack: PullRequestStack | null | undefined,
  currentPullNumber: number,
  currentBaseRef?: string | null
): boolean {
  if (!stack || !stack.layers.length || stack.layers.length !== stack.count) {
    return false;
  }

  const currentIndex = findCurrentStackLayerIndex(stack, currentPullNumber);
  if (currentIndex < 0) return false;

  const currentLayer = stack.layers[currentIndex];
  if (!currentLayer || !isActiveStackLayerState(currentLayer.state)) {
    return false;
  }

  const lowerLayers = stack.layers.slice(0, currentIndex);
  if (!lowerLayers.every((layer) => layer.state === 'merged')) {
    return false;
  }

  const upperLayers = stack.layers.slice(currentIndex + 1);
  if (upperLayers.some((layer) => isActiveStackLayerState(layer.state))) {
    return false;
  }

  const effectiveBaseRef = (currentLayer.baseRef || currentBaseRef || '').trim();
  return Boolean(effectiveBaseRef && effectiveBaseRef === stack.trunk);
}

/**
 * True when a Stack still has active inter-layer dependencies (multiple active
 * Layers, an unmerged lower Layer, or a single active Layer not yet targeting
 * the Trunk directly). Returns false for a Stack with only one remaining active
 * Layer targeting the Trunk directly — even when inspected from a merged Layer.
 */
export function hasMultiActiveStackDependencies(
  stack: PullRequestStack | null | undefined,
  currentPullNumber?: number,
  currentBaseRef?: string | null
): boolean {
  if (!stack) return false;
  if (!stack.layers.length || stack.layers.length !== stack.count) {
    return true;
  }

  const activeLayers = stack.layers.filter((layer) => isActiveStackLayerState(layer.state));
  if (activeLayers.length > 1) return true;
  if (activeLayers.length === 0) return false;

  const soleLayer = activeLayers[0]!;
  return !isSoleActiveStackLayer(
    stack,
    soleLayer.number,
    soleLayer.number === currentPullNumber ? currentBaseRef : undefined
  );
}
