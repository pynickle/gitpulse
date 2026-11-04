import type { MaybeRef } from 'vue';

type OpenGraphType =
  | 'article'
  | 'website'
  | 'book'
  | 'profile'
  | 'music.song'
  | 'music.album'
  | 'music.playlist'
  | 'music.radio_station'
  | 'video.movie'
  | 'video.episode'
  | 'video.tv_show'
  | 'video.other';

type TwitterCardType = 'summary' | 'summary_large_image' | 'app' | 'player';

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
  ogType?: MaybeRef<OpenGraphType>;
  /** Twitter card type. Omit to inherit `seo.meta.twitterCard` from nuxt.config. */
  twitterCard?: MaybeRef<TwitterCardType>;
}

/**
 * Unified composable for page title + SEO metadata.
 *
 * Uses the global `titleTemplate` from app.vue.
 * Supports reactive titles for dynamic content (issue/PR titles, etc.).
 *
 * `undefined` is the only "this page has no title of its own" signal: it lets the
 * nearest ancestor declaration (a parent route page) win, and falls back to the
 * template default when there is none. An empty string is taken literally, so a
 * page that forgets to name itself renders the app title instead of silently
 * inheriting whatever the layout or parent route happened to declare.
 *
 * @param title - Page title (string, Ref, or computed). Omit or pass `undefined` to inherit.
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
  const resolvedTitle = computed(() => unref(title));

  useSeoMeta({
    title: resolvedTitle,
    description: () => unref(meta?.description),
    ogTitle: () => unref(meta?.ogTitle) ?? resolvedTitle.value,
    ogDescription: () => unref(meta?.ogDescription) ?? unref(meta?.description),
    ogType: () => unref(meta?.ogType) ?? 'website',
    // Omit the key when unset: an undefined twitterCard still replaces the global default.
    // Title and description stay on Open Graph. X reads og:title and og:description;
    // twitter:title and twitter:description only repeat them and trip Unhead's deprecation check.
    ...(meta?.twitterCard === undefined ? {} : { twitterCard: () => unref(meta.twitterCard) }),
  });
}
