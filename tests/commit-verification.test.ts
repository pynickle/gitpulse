import { describe, expect, test } from 'bun:test';

import { commitVerificationMark } from '../app/utils/commitVerification';

describe('commitVerificationMark', () => {
  test('marks an accepted signature as verified', () => {
    expect(
      commitVerificationMark({
        verified: true,
        reason: 'valid',
        verifiedAt: '2024-01-01T00:00:00Z',
      })
    ).toBe('verified');
  });

  test('leaves an unsigned commit unmarked', () => {
    expect(
      commitVerificationMark({ verified: false, reason: 'unsigned', verifiedAt: null })
    ).toBeNull();
  });

  test('marks a rejected signature as unverified', () => {
    expect(commitVerificationMark({ verified: false, reason: 'bad_email', verifiedAt: null })).toBe(
      'unverified'
    );
    expect(
      commitVerificationMark({ verified: false, reason: 'ocsp_revoked', verifiedAt: null })
    ).toBe('unverified');
  });

  test('leaves a missing record unmarked', () => {
    expect(commitVerificationMark(null)).toBeNull();
    expect(commitVerificationMark(undefined)).toBeNull();
    expect(commitVerificationMark({ verified: false, reason: '', verifiedAt: null })).toBeNull();
  });
});
