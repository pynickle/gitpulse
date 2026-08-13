import type { ComposerLayoutId, UserComposerSettings } from '#shared/types/user-settings';

export const COMPOSER_SURFACES = [
  'conversation-sticky',
  'conversation-reply',
  'review-inline',
  'review-submit',
] as const;

export type ComposerSurface = (typeof COMPOSER_SURFACES)[number];

export const COMPOSER_PANES = ['write', 'preview'] as const;

export type ComposerPane = (typeof COMPOSER_PANES)[number];

export const COMPOSER_BLEED_MAX_VIEWPORT_WIDTH = 860;

export function resolveComposerInitialLayout(
  surface: ComposerSurface,
  settings: UserComposerSettings
): ComposerLayoutId {
  if (surface === 'review-submit') {
    return 'tabbed';
  }

  if (surface === 'review-inline') {
    return settings.reviewInlineDefaultLayout;
  }

  return settings.conversationDefaultLayout;
}

export function canSwitchComposerLayout(surface: ComposerSurface) {
  return surface !== 'review-submit';
}

export function shouldComposerBleed(input: {
  surface: ComposerSurface;
  layout: ComposerLayoutId;
  expanded: boolean;
  viewportWidth: number;
}) {
  return (
    input.surface === 'conversation-sticky' &&
    input.layout === 'split' &&
    input.expanded &&
    input.viewportWidth > COMPOSER_BLEED_MAX_VIEWPORT_WIDTH
  );
}

export function resolveComposerActivePaneAfterLayoutChange(
  _nextLayout: ComposerLayoutId
): ComposerPane {
  return 'write';
}

export function mapProportionalScrollOffset(
  sourceScrollTop: number,
  sourceScrollHeight: number,
  targetScrollHeight: number
) {
  if (sourceScrollHeight <= 0 || targetScrollHeight <= 0) {
    return 0;
  }

  return (sourceScrollTop / sourceScrollHeight) * targetScrollHeight;
}
