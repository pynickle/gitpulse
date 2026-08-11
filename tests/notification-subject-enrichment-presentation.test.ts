import { describe, expect, test } from 'bun:test';

import getNotificationSubjectEnrichmentPresentation from '../app/utils/getNotificationSubjectEnrichmentPresentation';

describe('Notification Subject Enrichment presentation', () => {
  test('uses an animated first-load fallback while enrichment is pending', () => {
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'pending',
      })
    ).toEqual({
      avatarMode: 'loading',
      isPending: true,
      isError: false,
      animatesSubjectBadge: true,
      showsTypeBadge: true,
      showsFailureMessage: false,
    });
  });

  test('keeps an existing author avatar during refresh', () => {
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'pending',
        authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      }).avatarMode
    ).toBe('avatar');
  });

  test('stops motion and shows failure feedback after an error', () => {
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'error',
      })
    ).toEqual({
      avatarMode: 'error',
      isPending: false,
      isError: true,
      animatesSubjectBadge: false,
      showsTypeBadge: false,
      showsFailureMessage: true,
    });
  });

  test('keeps last-known author presentation after an error', () => {
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'error',
        authorAvatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      }).avatarMode
    ).toBe('avatar');
  });

  test('does not overlap an error avatar with the subject type badge', () => {
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'error',
      }).showsTypeBadge
    ).toBe(false);
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'loaded',
      }).showsTypeBadge
    ).toBe(true);
  });

  test('uses a non-animated neutral fallback for unavailable subjects', () => {
    expect(
      getNotificationSubjectEnrichmentPresentation({
        stateStatus: 'unavailable',
      }).avatarMode
    ).toBe('static');
  });
});
