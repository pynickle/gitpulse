import type { MaybeRef } from 'vue';

/**
 * SEO meta options for the page.
 * All fields are optional. When omitted, global defaults from nuxt.config.ts apply.
 */
export interface PageMetaOptions {
  /** Page description for SEO */
  description?: MaybeRef<string>;
  /** Open Graph title (defaults to page title if omitted) */
  ogTitle?: MaybeRef<string>;
  /** Open Graph description (defaults to description if omitted) */
  ogDescription?: MaybeRef<string>;
  /** Open Graph type (default: 'website') */
  ogType?: string;
  /** Twitter card type (default: 'summary') */
  twitterCard?: string;
}

/**
 * Unified composable for page title + SEO metadata.
 *
 * Uses the global `titleTemplate` from nuxt.config.ts.
 * Supports reactive titles for dynamic content (issue/PR titles, etc.).
 *
 * @param title - Page title (string, Ref, or computed). Pass `undefined` to use the global default.
 * @param meta - Optional SEO metadata fields.
 *
 * @example
 * // Static page
 * usePageMeta('Dashboard')
 *
 * @example
 * // Dynamic page with reactive title
 * const issueTitle = computed(() => issue.value?.title ?? 'Issue')
 * usePageMeta(issueTitle, {
 *   description: computed(() => issue.value?.body?.slice(0, 160) ?? ''),
 * })
 *
 * @example
 * // With i18n
 * const { t } = useI18n()
 * usePageMeta(t('dashboard.settings.pageTitle'))
 */
export function usePageMeta(title?: MaybeRef<string | undefined>, meta?: PageMetaOptions) {
  const resolvedTitle = computed(() => {
    const val = unref(title);
    // Empty string or undefined → let titleTemplate use its default
    return val && val.length > 0 ? val : undefined;
  });

  useHead({
    title: resolvedTitle,
  });

  useSeoMeta({
    description: () => unref(meta?.description),
    ogTitle: () => unref(meta?.ogTitle) ?? resolvedTitle.value,
    ogDescription: () => unref(meta?.ogDescription) ?? unref(meta?.description),
    ogType: meta?.ogType ?? 'website',
    twitterCard: meta?.twitterCard ?? 'summary',
    twitterTitle: () => unref(meta?.ogTitle) ?? resolvedTitle.value,
    twitterDescription: () => unref(meta?.ogDescription) ?? unref(meta?.description),
  });
}
