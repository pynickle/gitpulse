import * as z from 'zod';

import { parseZodRequestBody } from './zod-validation-utils';

const maxSubjectStateTargets = 50;
const maxGraphQLInt = 2_147_483_647;

const subjectTargetSchema = z.strictObject({
  key: z.string().trim().min(1),
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
  type: z.enum(['issues', 'pulls', 'discussions']),
  number: z.number().int().positive().max(maxGraphQLInt),
});
const subjectTargetsRequestSchema = z.strictObject({
  targets: z.array(subjectTargetSchema).max(maxSubjectStateTargets),
});

export function parseNotificationSubjectTargetsBody(body: unknown) {
  return parseZodRequestBody(
    subjectTargetsRequestSchema,
    body,
    'Invalid notification subject state request body'
  ).targets;
}
