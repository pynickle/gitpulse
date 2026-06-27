import * as z from 'zod';

import { parseZodRequestBody } from '#server/utils/zod-validation-utils';

const requiredBodyTextSchema = z.strictObject({
  body: z.string().trim().min(1),
});

const issueLabelsBodySchema = z.strictObject({
  labels: z.array(z.string().trim().min(1)),
});

const issueAssigneesBodySchema = z.strictObject({
  assignees: z
    .array(z.string().trim().min(1))
    .min(1)
    .transform((assignees) => {
      const normalized: string[] = [];
      const seen = new Set<string>();

      for (const assignee of assignees) {
        const key = assignee.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          normalized.push(assignee);
        }
      }

      return normalized;
    }),
});

const issueLockReasonSchema = z.enum(['off-topic', 'too heated', 'resolved', 'spam']);
const issueLockBodySchema = z.strictObject({
  lock_reason: issueLockReasonSchema.optional(),
});

const reviewThreadResolveBodySchema = z.strictObject({
  resolved: z.boolean(),
});

const repoSubscriptionBodySchema = z.strictObject({
  subscribed: z.boolean(),
  ignored: z.boolean(),
});

export type IssueLockReason = z.output<typeof issueLockReasonSchema>;

export function parseRequiredBodyText(body: unknown, statusMessage: string) {
  return parseZodRequestBody(requiredBodyTextSchema, body, statusMessage).body;
}

export function parseIssueLabelsBody(body: unknown) {
  return parseZodRequestBody(issueLabelsBodySchema, body, 'Invalid issue labels request body')
    .labels;
}

export function parseIssueAssigneesBody(body: unknown) {
  return parseZodRequestBody(issueAssigneesBodySchema, body, 'Invalid issue assignees request body')
    .assignees;
}

export function parseIssueLockBody(body: unknown): IssueLockReason | undefined {
  return parseZodRequestBody(issueLockBodySchema, body, 'Invalid issue lock request body')
    .lock_reason;
}

export function parseReviewThreadResolveBody(body: unknown) {
  return parseZodRequestBody(
    reviewThreadResolveBodySchema,
    body,
    'Invalid review thread resolve request body'
  ).resolved;
}

export function parseRepoSubscriptionBody(body: unknown) {
  return parseZodRequestBody(repoSubscriptionBodySchema, body, 'Invalid subscription request body');
}
