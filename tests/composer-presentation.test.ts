import { describe, expect, test } from 'bun:test';

import type { UserComposerSettings } from '../shared/types/user-settings';
import {
  canSwitchComposerLayout,
  mapProportionalScrollOffset,
  resolveComposerActivePaneAfterLayoutChange,
  resolveComposerInitialLayout,
  shouldComposerBleed,
  type ComposerSurface,
} from '../shared/utils/composer-presentation';

const defaultSettings: UserComposerSettings = {
  conversationDefaultLayout: 'split',
  reviewInlineDefaultLayout: 'tabbed',
};

const tabbedConversationSettings: UserComposerSettings = {
  conversationDefaultLayout: 'tabbed',
  reviewInlineDefaultLayout: 'split',
};

describe('composer presentation policy', () => {
  test.each([
    {
      surface: 'conversation-sticky' as const,
      settings: defaultSettings,
      layout: 'split' as const,
    },
    {
      surface: 'conversation-reply' as const,
      settings: defaultSettings,
      layout: 'split' as const,
    },
    {
      surface: 'review-inline' as const,
      settings: defaultSettings,
      layout: 'tabbed' as const,
    },
    {
      surface: 'review-submit' as const,
      settings: defaultSettings,
      layout: 'tabbed' as const,
    },
    {
      surface: 'conversation-sticky' as const,
      settings: tabbedConversationSettings,
      layout: 'tabbed' as const,
    },
    {
      surface: 'conversation-reply' as const,
      settings: tabbedConversationSettings,
      layout: 'tabbed' as const,
    },
    {
      surface: 'review-inline' as const,
      settings: tabbedConversationSettings,
      layout: 'split' as const,
    },
    {
      surface: 'review-submit' as const,
      settings: tabbedConversationSettings,
      layout: 'tabbed' as const,
    },
  ])(
    'seeds $surface from settings as $layout',
    ({
      surface,
      settings,
      layout,
    }: {
      surface: ComposerSurface;
      settings: UserComposerSettings;
      layout: 'tabbed' | 'split';
    }) => {
      expect(resolveComposerInitialLayout(surface, settings)).toBe(layout);
    }
  );

  test('keeps the review submit composer tabbed and not switchable', () => {
    expect(resolveComposerInitialLayout('review-submit', defaultSettings)).toBe('tabbed');
    expect(resolveComposerInitialLayout('review-submit', tabbedConversationSettings)).toBe(
      'tabbed'
    );
    expect(canSwitchComposerLayout('review-submit')).toBe(false);
    expect(canSwitchComposerLayout('conversation-sticky')).toBe(true);
    expect(canSwitchComposerLayout('conversation-reply')).toBe(true);
    expect(canSwitchComposerLayout('review-inline')).toBe(true);
  });

  test.each([
    {
      name: 'expanded sticky conversation split on a wide viewport',
      input: {
        surface: 'conversation-sticky' as const,
        layout: 'split' as const,
        expanded: true,
        viewportWidth: 861,
      },
      bleed: true,
    },
    {
      name: 'expanded sticky conversation split at the 860px breakpoint',
      input: {
        surface: 'conversation-sticky' as const,
        layout: 'split' as const,
        expanded: true,
        viewportWidth: 860,
      },
      bleed: false,
    },
    {
      name: 'collapsed sticky conversation split on a wide viewport',
      input: {
        surface: 'conversation-sticky' as const,
        layout: 'split' as const,
        expanded: false,
        viewportWidth: 1200,
      },
      bleed: false,
    },
    {
      name: 'expanded sticky conversation tabbed on a wide viewport',
      input: {
        surface: 'conversation-sticky' as const,
        layout: 'tabbed' as const,
        expanded: true,
        viewportWidth: 1200,
      },
      bleed: false,
    },
    {
      name: 'expanded discussion reply split on a wide viewport',
      input: {
        surface: 'conversation-reply' as const,
        layout: 'split' as const,
        expanded: true,
        viewportWidth: 1200,
      },
      bleed: false,
    },
    {
      name: 'review inline split on a wide viewport',
      input: {
        surface: 'review-inline' as const,
        layout: 'split' as const,
        expanded: true,
        viewportWidth: 1200,
      },
      bleed: false,
    },
    {
      name: 'review submit tabbed on a wide viewport',
      input: {
        surface: 'review-submit' as const,
        layout: 'tabbed' as const,
        expanded: true,
        viewportWidth: 1200,
      },
      bleed: false,
    },
  ])('bleed is $bleed for $name', ({ input, bleed }) => {
    expect(shouldComposerBleed(input)).toBe(bleed);
  });

  test('returns Write after leaving Split', () => {
    expect(resolveComposerActivePaneAfterLayoutChange('tabbed')).toBe('write');
    expect(resolveComposerActivePaneAfterLayoutChange('split')).toBe('write');
  });

  test('maps proportional scroll from source extents onto the target pane', () => {
    expect(mapProportionalScrollOffset(40, 200, 500)).toBe(100);
    expect(mapProportionalScrollOffset(0, 200, 500)).toBe(0);
    expect(mapProportionalScrollOffset(200, 200, 500)).toBe(500);
    expect(mapProportionalScrollOffset(50, 0, 400)).toBe(0);
    expect(mapProportionalScrollOffset(50, 200, 0)).toBe(0);
  });
});
