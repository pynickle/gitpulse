import * as z from 'zod';

import { parseZodRequestBody } from '#server/utils/zod-validation-utils';
import {
  CUSTOM_TAB_SOURCES,
  CUSTOM_TAB_SUBTITLE_MODES,
  GITHUB_SEARCH_ARCHIVED_FILTERS,
  GITHUB_SEARCH_DRAFT_FILTERS,
  GITHUB_SEARCH_ISSUE_STATES,
  GITHUB_SEARCH_ORDERS,
  GITHUB_SEARCH_PULL_STATES,
  GITHUB_SEARCH_REVIEW_FILTERS,
  GITHUB_SEARCH_SCOPES,
  GITHUB_SEARCH_SORTS,
  GITHUB_SEARCH_VISIBILITY_FILTERS,
} from '#shared/types/custom-search';
import { TAB_GROUP_SOURCES } from '#shared/types/tab-groups';
import { APP_FONT_IDS, CODE_FONT_IDS } from '#shared/types/user-settings';
import { normalizeSystemFontFamily } from '#shared/utils/user-settings';

const appFontSchema = z.enum(APP_FONT_IDS);
const codeFontSchema = z.enum(CODE_FONT_IDS);
const fontFamilySchema = z
  .string()
  .trim()
  .refine((fontFamily) => normalizeSystemFontFamily(fontFamily) === fontFamily, {
    message: 'Invalid system font family',
  });

const nonEmptyStringSchema = z.string().trim().min(1).max(240);
const optionalNonEmptyStringSchema = nonEmptyStringSchema.optional();

const fontSettingsPatchSchema = z
  .strictObject({
    appFont: appFontSchema.optional(),
    codeFont: codeFontSchema.optional(),
    appSystemFont: fontFamilySchema.optional(),
    codeSystemFont: fontFamilySchema.optional(),
  })
  .refine((fonts) => Object.keys(fonts).length > 0, {
    message: 'At least one font setting is required',
  });

const tabGroupSchema = z.strictObject({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  parentId: z.union([nonEmptyStringSchema, z.null()]).optional(),
  collapsed: z.boolean().optional(),
  source: z.enum(TAB_GROUP_SOURCES).optional(),
});

const searchScopeSchema = z.enum(GITHUB_SEARCH_SCOPES);
const sharedSearchQueryShape = {
  text: optionalNonEmptyStringSchema,
  repo: optionalNonEmptyStringSchema,
  org: optionalNonEmptyStringSchema,
  user: optionalNonEmptyStringSchema,
  labels: z.array(nonEmptyStringSchema).optional(),
  author: optionalNonEmptyStringSchema,
  assignee: optionalNonEmptyStringSchema,
  mentions: optionalNonEmptyStringSchema,
  commenter: optionalNonEmptyStringSchema,
  involves: optionalNonEmptyStringSchema,
  milestone: optionalNonEmptyStringSchema,
  scopes: z.array(searchScopeSchema).optional(),
  visibility: z.enum(GITHUB_SEARCH_VISIBILITY_FILTERS).optional(),
  archived: z.enum(GITHUB_SEARCH_ARCHIVED_FILTERS).optional(),
  sort: z.enum(GITHUB_SEARCH_SORTS).optional(),
  order: z.enum(GITHUB_SEARCH_ORDERS).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
};

const issueSearchQuerySchema = z.strictObject({
  ...sharedSearchQueryShape,
  type: z.literal('issues'),
  state: z.enum(GITHUB_SEARCH_ISSUE_STATES).optional(),
});

const pullSearchQuerySchema = z.strictObject({
  ...sharedSearchQueryShape,
  type: z.literal('pulls'),
  state: z.enum(GITHUB_SEARCH_PULL_STATES).optional(),
  draft: z.enum(GITHUB_SEARCH_DRAFT_FILTERS).optional(),
  review: z.enum(GITHUB_SEARCH_REVIEW_FILTERS).optional(),
  base: optionalNonEmptyStringSchema,
  head: optionalNonEmptyStringSchema,
});

const customTabSchema = z
  .strictObject({
    id: nonEmptyStringSchema,
    groupId: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    subtitle: optionalNonEmptyStringSchema,
    subtitleMode: z.enum(CUSTOM_TAB_SUBTITLE_MODES),
    source: z.enum(CUSTOM_TAB_SOURCES),
    query: z.discriminatedUnion('type', [issueSearchQuerySchema, pullSearchQuerySchema]),
  })
  .superRefine((tab, context) => {
    if (tab.subtitleMode === 'custom' && !tab.subtitle) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subtitle'],
        message: 'Custom subtitle is required',
      });
    }

    if (tab.subtitleMode !== 'custom' && tab.subtitle !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subtitle'],
        message: 'Subtitle is only allowed for custom subtitle mode',
      });
    }
  });

export const userSettingsPatchSchema = z
  .strictObject({
    fonts: fontSettingsPatchSchema.optional(),
    tabGroups: z.array(tabGroupSchema).optional(),
    customTabs: z.array(customTabSchema).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one settings field is required',
  });

export function parseUserSettingsPatchBody(
  body: unknown
): z.output<typeof userSettingsPatchSchema> {
  return parseZodRequestBody(userSettingsPatchSchema, body, 'Invalid settings request body');
}
