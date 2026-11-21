import { expect, test } from 'bun:test';

import { hidesUnrequestedCopilot } from '../shared/utils/copilot-review';

const copilot = { login: 'copilot-pull-request-reviewer[bot]' };
const reader = { login: 'octocat' };

test('hides the Copilot offer only while hiding is on and Copilot is not a reviewer', () => {
  expect(hidesUnrequestedCopilot({ hiding: true })).toBe(true);
  expect(hidesUnrequestedCopilot({ hiding: true, reviewerItems: [reader] })).toBe(true);
  expect(
    hidesUnrequestedCopilot({
      hiding: true,
      reviewerItems: [reader],
      requestedReviewers: [copilot],
    })
  ).toBe(true);
  expect(hidesUnrequestedCopilot({ hiding: true, reviewerItems: [copilot] })).toBe(false);
  expect(
    hidesUnrequestedCopilot({ hiding: true, reviewerItems: [], requestedReviewers: [copilot] })
  ).toBe(false);
  expect(hidesUnrequestedCopilot({ hiding: false })).toBe(false);
  expect(hidesUnrequestedCopilot({ hiding: false, reviewerItems: [reader] })).toBe(false);
});
