import type * as z from 'zod';

export function parseZodRequestBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
  statusMessage: string
): z.output<TSchema> {
  const result = schema.safeParse(body);

  if (result.success) {
    return result.data;
  }

  throw createError({
    statusCode: 400,
    statusMessage,
    data: {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.map((segment) =>
          typeof segment === 'symbol' ? segment.toString() : segment
        ),
        code: issue.code,
        message: issue.message,
      })),
    },
  });
}
