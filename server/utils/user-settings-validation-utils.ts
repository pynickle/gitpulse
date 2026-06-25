import * as z from 'zod';

import { parseZodRequestBody } from '#server/utils/zod-validation-utils';
import {
  CUSTOM_TAB_SOURCES,
  CUSTOM_TAB_SUBTITLE_MODES,
  GITHUB_SEARCH_ARCHIVED_FILTERS,
  GITHUB_SEARCH_DRAFT_FILTERS,
  GITHUB_SEARCH_ENDPOINTS,
  GITHUB_SEARCH_ISSUE_STATES,
  GITHUB_SEARCH_PULL_STATES,
  GITHUB_SEARCH_REVIEW_FILTERS,
  GITHUB_SEARCH_SCOPES,
  GITHUB_SEARCH_VISIBILITY_FILTERS,
} from '#shared/types/custom-search';
import { TAB_GROUP_SOURCES } from '#shared/types/tab-groups';
import {
  APP_FONT_IDS,
  CODE_FONT_IDS,
  LINK_TARGET_IDS,
  NOTIFICATION_READ_MARK_DELAY_SECONDS,
  NOTIFICATION_READ_MARK_MODE_IDS,
  SHIKI_DARK_THEME_IDS,
  SHIKI_LIGHT_THEME_IDS,
} from '#shared/types/user-settings';
import { normalizeSystemFontFamily } from '#shared/utils/user-settings';

const appFontSchema = z.enum(APP_FONT_IDS);
const codeFontSchema = z.enum(CODE_FONT_IDS);
const notificationReadMarkModeSchema = z.enum(NOTIFICATION_READ_MARK_MODE_IDS);
const linkTargetSchema = z.enum(LINK_TARGET_IDS);
const notificationReadMarkDelaySecondsSchema = z
  .number()
  .int()
  .refine(
    (value): value is (typeof NOTIFICATION_READ_MARK_DELAY_SECONDS)[number] =>
      NOTIFICATION_READ_MARK_DELAY_SECONDS.includes(
        value as (typeof NOTIFICATION_READ_MARK_DELAY_SECONDS)[number]
      ),
    {
      message: 'Invalid notification read delay',
    }
  );
const shikiLightThemeSchema = z.enum(SHIKI_LIGHT_THEME_IDS);
const shikiDarkThemeSchema = z.enum(SHIKI_DARK_THEME_IDS);
const fontFamilySchema = z
  .string()
  .trim()
  .refine((fontFamily) => normalizeSystemFontFamily(fontFamily) === fontFamily, {
    message: 'Invalid system font family',
  });

const nonEmptyStringSchema = z.string().trim().min(1).max(240);
const longNonEmptyStringSchema = z.string().trim().min(1).max(1000);
const optionalNonEmptyStringSchema = nonEmptyStringSchema.optional();
const optionalLongNonEmptyStringSchema = longNonEmptyStringSchema.optional();

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

const appearanceSettingsPatchSchema = z
  .strictObject({
    shikiLightTheme: shikiLightThemeSchema.optional(),
    shikiDarkTheme: shikiDarkThemeSchema.optional(),
  })
  .refine((appearance) => Object.keys(appearance).length > 0, {
    message: 'At least one appearance setting is required',
  });

const notificationBehaviorSettingsPatchSchema = z
  .strictObject({
    readMarkMode: notificationReadMarkModeSchema.optional(),
    readMarkDelaySeconds: notificationReadMarkDelaySecondsSchema.optional(),
  })
  .refine((notificationBehavior) => Object.keys(notificationBehavior).length > 0, {
    message: 'At least one notification behavior setting is required',
  });

const navigationSettingsPatchSchema = z
  .strictObject({
    linkTarget: linkTargetSchema.optional(),
  })
  .refine((navigation) => Object.keys(navigation).length > 0, {
    message: 'At least one navigation setting is required',
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
  endpoint: z.enum(GITHUB_SEARCH_ENDPOINTS).optional(),
  syntax: z.string().trim().max(4000).optional(),
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

const notificationLabelSchema = z.strictObject({
  name: nonEmptyStringSchema,
  color: z.string().trim().min(1).max(32),
});

const notificationSubjectSchema = z.strictObject({
  title: optionalNonEmptyStringSchema,
  type: optionalNonEmptyStringSchema,
  url: optionalLongNonEmptyStringSchema,
  number: z.number().int().positive().optional(),
  state: z.enum(['open', 'closed', 'merged']).optional(),
  isAnswered: z.boolean().optional(),
  stateStatus: z.enum(['pending', 'loaded', 'error', 'unavailable']).optional(),
  labels: z.array(notificationLabelSchema).optional(),
  authorLogin: optionalNonEmptyStringSchema,
  authorAvatarUrl: optionalLongNonEmptyStringSchema,
});

const notificationRepositorySchema = z.strictObject({
  full_name: optionalNonEmptyStringSchema,
  url: optionalLongNonEmptyStringSchema,
  owner: z
    .strictObject({
      login: optionalNonEmptyStringSchema,
      avatar_url: optionalLongNonEmptyStringSchema,
    })
    .optional(),
});

const dashboardNotificationSchema = z.strictObject({
  id: z.union([nonEmptyStringSchema, z.number()]),
  subject: notificationSubjectSchema.optional(),
  repository: notificationRepositorySchema.optional(),
  unread: z.boolean().optional(),
  updated_at: z.string().trim().min(1).max(80).optional(),
  reason: optionalNonEmptyStringSchema,
  html_url: optionalLongNonEmptyStringSchema,
});

const notificationTodoSchema = z.strictObject({
  id: nonEmptyStringSchema,
  addedAt: z.string().trim().min(1).max(80),
  notification: dashboardNotificationSchema,
});

export const userSettingsPatchSchema = z
  .strictObject({
    fonts: fontSettingsPatchSchema.optional(),
    appearance: appearanceSettingsPatchSchema.optional(),
    notificationBehavior: notificationBehaviorSettingsPatchSchema.optional(),
    navigation: navigationSettingsPatchSchema.optional(),
    tabGroups: z.array(tabGroupSchema).optional(),
    customTabs: z.array(customTabSchema).optional(),
    notificationTodos: z.array(notificationTodoSchema).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one settings field is required',
  });

export function parseUserSettingsPatchBody(
  body: unknown
): z.output<typeof userSettingsPatchSchema> {
  return parseZodRequestBody(userSettingsPatchSchema, body, 'Invalid settings request body');
}
