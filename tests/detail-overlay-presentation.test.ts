import { describe, expect, test } from 'bun:test';

import {
  presentDetailBottomBar,
  reduceDetailOverlaySheets,
  resolveDetailSidebarMetadataCount,
} from '../shared/utils/detail-overlay-presentation';

describe('detail overlay presentation policy', () => {
  test('toggles sidebar and composer sheets with mutual exclusion', () => {
    expect(reduceDetailOverlaySheets({ openSheet: null }, { type: 'toggle-sidebar' })).toEqual({
      openSheet: 'sidebar',
    });
    expect(reduceDetailOverlaySheets({ openSheet: 'sidebar' }, { type: 'toggle-sidebar' })).toEqual(
      {
        openSheet: null,
      }
    );
    expect(
      reduceDetailOverlaySheets({ openSheet: 'composer' }, { type: 'toggle-sidebar' })
    ).toEqual({
      openSheet: 'sidebar',
    });
    expect(
      reduceDetailOverlaySheets({ openSheet: 'sidebar' }, { type: 'toggle-composer' })
    ).toEqual({
      openSheet: 'composer',
    });
    expect(
      reduceDetailOverlaySheets({ openSheet: 'composer' }, { type: 'toggle-composer' })
    ).toEqual({
      openSheet: null,
    });
  });

  test.each([
    'dismiss-sheet',
    'cancel-composer',
    'submit-composer',
    'navigate-from-sheet',
  ] as const)('closes the active sheet on %s', (actionType) => {
    expect(reduceDetailOverlaySheets({ openSheet: 'sidebar' }, { type: actionType })).toEqual({
      openSheet: null,
    });
    expect(reduceDetailOverlaySheets({ openSheet: 'composer' }, { type: actionType })).toEqual({
      openSheet: null,
    });
  });

  test('presents the Detail Bottom Bar only on narrow active detail panes without suppression', () => {
    expect(
      presentDetailBottomBar({
        isNarrowViewport: true,
        hasActivePane: true,
        isFeedbackVisible: false,
        isPullRequestReviewActive: false,
        openSheet: 'sidebar',
        keyboardOpen: false,
        inlineReplyOpen: false,
      })
    ).toEqual({ openSheet: 'sidebar', showBottomBar: true });

    expect(
      presentDetailBottomBar({
        isNarrowViewport: false,
        hasActivePane: true,
        isFeedbackVisible: false,
        isPullRequestReviewActive: false,
        openSheet: 'sidebar',
        keyboardOpen: false,
        inlineReplyOpen: false,
      })
    ).toEqual({ openSheet: null, showBottomBar: false });

    expect(
      presentDetailBottomBar({
        isNarrowViewport: true,
        hasActivePane: false,
        isFeedbackVisible: false,
        isPullRequestReviewActive: false,
        openSheet: 'sidebar',
        keyboardOpen: false,
        inlineReplyOpen: false,
      })
    ).toEqual({ openSheet: null, showBottomBar: false });

    expect(
      presentDetailBottomBar({
        isNarrowViewport: true,
        hasActivePane: true,
        isFeedbackVisible: true,
        isPullRequestReviewActive: false,
        openSheet: 'sidebar',
        keyboardOpen: false,
        inlineReplyOpen: false,
      })
    ).toEqual({ openSheet: null, showBottomBar: false });

    expect(
      presentDetailBottomBar({
        isNarrowViewport: true,
        hasActivePane: true,
        isFeedbackVisible: false,
        isPullRequestReviewActive: true,
        openSheet: 'sidebar',
        keyboardOpen: false,
        inlineReplyOpen: false,
      })
    ).toEqual({ openSheet: null, showBottomBar: false });
  });

  test('hides the Detail Bottom Bar while the keyboard or an inline reply composer is open', () => {
    expect(
      presentDetailBottomBar({
        isNarrowViewport: true,
        hasActivePane: true,
        isFeedbackVisible: false,
        isPullRequestReviewActive: false,
        openSheet: 'composer',
        keyboardOpen: true,
        inlineReplyOpen: false,
      })
    ).toEqual({ openSheet: 'composer', showBottomBar: false });

    expect(
      presentDetailBottomBar({
        isNarrowViewport: true,
        hasActivePane: true,
        isFeedbackVisible: false,
        isPullRequestReviewActive: false,
        openSheet: null,
        keyboardOpen: false,
        inlineReplyOpen: true,
      })
    ).toEqual({ openSheet: null, showBottomBar: false });
  });

  test('computes metadata counts per detail subject type', () => {
    expect(
      resolveDetailSidebarMetadataCount({
        kind: 'pull-request',
        labelCount: 2,
        assigneeCount: 1,
        reviewerCount: 3,
      })
    ).toBe(6);

    expect(
      resolveDetailSidebarMetadataCount({
        kind: 'issue',
        labelCount: 3,
        assigneeCount: 2,
        hasIssueType: true,
      })
    ).toBe(6);

    expect(
      resolveDetailSidebarMetadataCount({
        kind: 'issue',
        labelCount: 0,
        assigneeCount: 0,
        hasIssueType: false,
      })
    ).toBe(0);

    expect(resolveDetailSidebarMetadataCount({ kind: 'discussion' })).toBe(0);
    expect(resolveDetailSidebarMetadataCount({ kind: 'release' })).toBe(0);
    expect(resolveDetailSidebarMetadataCount({ kind: 'repository' })).toBe(0);
  });
});
