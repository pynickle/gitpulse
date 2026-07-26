<script setup lang="ts">
import { BookOpenIcon, ExternalLinkIcon, FileTextIcon, ListIcon, Loader2Icon } from '@lucide/vue';
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import { splitWikiHtmlSegments, type WikiHtmlSegment } from '#shared/utils/github-wiki';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';
import {
  buildChildPageRouteFromNavigationEntry,
  buildDashboardQueryFromNavigationEntry,
} from '~/utils/dashboardUrlNavigationUtils';

const AsyncMermaidBlock = defineAsyncComponent(() => import('~/components/ui/MermaidBlock.vue'));

interface WikiTocItem {
  id: string;
  text: string;
  level: number;
}

const { t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const { navigateToWiki, goBack, goToHome, shouldShowHomeButton } = useNavigationHistory();
const { openRepository } = useDashboardRepositoryNavigation();

const {
  pages,
  available,
  wikiHtmlUrl,
  pagesLoading,
  pagesError,
  page,
  pageLoading,
  pageError,
  fetchPages,
  fetchPage,
} = useRepoWiki();

/** Target repository from the `?repo=owner/name` query. */
const repoTarget = computed(() => {
  const rawValue = getQueryParamValue(route.query.repo);
  return rawValue ? parseGitHubRepoPath(rawValue) : null;
});

const repoFullName = computed(() =>
  repoTarget.value ? `${repoTarget.value.owner}/${repoTarget.value.repo}` : ''
);

const pageTitle = computed(() =>
  repoFullName.value ? t('wikiPage.pageTitle', { repo: repoFullName.value }) : ''
);

usePageMeta(pageTitle);

const requestedPage = computed(() => getQueryParamValue(route.query.page)?.trim() || '');

/** Default page: the sidebar's Home entry, falling back to the first page. */
const defaultSlug = computed(() => {
  const home = pages.value.find((entry) => entry.slug.toLowerCase() === 'home');
  return home?.slug ?? pages.value[0]?.slug ?? 'Home';
});

const activeSlug = computed(() => requestedPage.value || defaultSlug.value);

const activePageTitle = computed(() => {
  const entry = pages.value.find((candidate) => candidate.slug === activeSlug.value);
  return entry?.title ?? activeSlug.value;
});

const pageHtmlUrl = computed(() => page.value?.htmlUrl || wikiHtmlUrl.value);

/**
 * GitHub-rendered fallback body, split into mermaid diagrams (rendered by
 * MermaidBlock) and HTML chunks (sanitized before hitting `v-html`).
 */
const htmlSegments = computed<WikiHtmlSegment[]>(() => {
  if (page.value?.format !== 'html' || !page.value.content) return [];

  return splitWikiHtmlSegments(page.value.content)
    .map((segment) =>
      segment.type === 'html'
        ? { type: 'html' as const, html: sanitizeWikiHtml(segment.html) }
        : segment
    )
    .filter((segment) => segment.type === 'mermaid' || segment.html.trim().length > 0);
});

const initialLoading = computed(
  () => pagesLoading.value && pages.value.length === 0 && !pagesError.value
);

const fetchCurrentPages = async () => {
  const target = repoTarget.value;
  if (!target) return;

  await fetchPages(target.owner, target.repo);
};

const fetchCurrentPage = async () => {
  const target = repoTarget.value;
  if (!target) return;

  await fetchPage(target.owner, target.repo, activeSlug.value);
};

/** Record this page in navigation history so "back" from child pages returns here. */
const syncNavigationEntry = () => {
  const target = repoTarget.value;
  if (!target) return;

  navigateToWiki(target.owner, target.repo, requestedPage.value || undefined);
};

const contentRef = ref<HTMLElement | null>(null);
const tocItems = shallowRef<WikiTocItem[]>([]);
const activeTocId = shallowRef('');

let headingObserver: IntersectionObserver | null = null;
let contentObserver: MutationObserver | null = null;
let collectTimer: ReturnType<typeof setTimeout> | null = null;

const tocMinLevel = computed(() =>
  tocItems.value.length ? Math.min(...tocItems.value.map((item) => item.level)) : 1
);

const slugifyHeading = (text: string, index: number) => {
  const base = text
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^\p{L}\p{N}-]/gu, '');
  return `wiki-heading-${index}${base ? `-${base}` : ''}`;
};

/** Highlight the section crossing the top quarter of the viewport. */
const observeHeadings = (headings: HTMLElement[]) => {
  headingObserver?.disconnect();
  headingObserver = null;

  if (!headings.length || typeof IntersectionObserver === 'undefined') return;

  headingObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeTocId.value = entry.target.id;
          break;
        }
      }
    },
    { rootMargin: '0px 0px -75% 0px', threshold: 0 }
  );

  for (const heading of headings) {
    headingObserver.observe(heading);
  }
};

/**
 * Builds the TOC from the rendered DOM so both content paths (MarkdownRenderer
 * and the sanitized GitHub HTML) are covered without renderer-specific logic.
 */
const collectHeadings = () => {
  const root = contentRef.value;
  if (!root) {
    tocItems.value = [];
    observeHeadings([]);
    return;
  }

  const headings = [...root.querySelectorAll<HTMLElement>('h1, h2, h3, h4')].filter(
    (heading) =>
      !heading.classList.contains('wiki-page__content-title') &&
      Boolean(heading.textContent?.trim())
  );

  const items = headings.map((heading, index) => {
    if (!heading.id) {
      heading.id = slugifyHeading(heading.textContent || '', index);
    }

    return {
      id: heading.id,
      text: (heading.textContent || '').trim(),
      level: Number(heading.tagName.slice(1)) || 1,
    };
  });

  // A single heading is just the page title restated — not worth a TOC.
  const hasToc = items.length >= 2;
  tocItems.value = hasToc ? items : [];
  observeHeadings(hasToc ? headings : []);
};

const scheduleCollectHeadings = () => {
  if (collectTimer) clearTimeout(collectTimer);
  // Content renders in async waves (markdown parse, shiki, mermaid); debounce
  // so the TOC settles once instead of thrashing per mutation.
  collectTimer = setTimeout(collectHeadings, 150);
};

watch(contentRef, (element) => {
  contentObserver?.disconnect();

  if (!element || typeof MutationObserver === 'undefined') {
    tocItems.value = [];
    observeHeadings([]);
    return;
  }

  contentObserver ??= new MutationObserver(scheduleCollectHeadings);
  contentObserver.observe(element, { childList: true, subtree: true, characterData: true });
  scheduleCollectHeadings();
});

onBeforeUnmount(() => {
  if (collectTimer) clearTimeout(collectTimer);
  contentObserver?.disconnect();
  headingObserver?.disconnect();
});

const scrollToHeading = (id: string) => {
  const heading = contentRef.value?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (!heading) return;

  activeTocId.value = id;
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const safeDecodeSlug = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/** Keep wiki-internal links inside the app; everything else opens a new tab. */
const handleWikiHtmlClick = (event: MouseEvent) => {
  const anchor = (event.target as HTMLElement | null)?.closest('a');
  if (!anchor) return;

  const href = anchor.getAttribute('href') || '';
  // In-page section anchors keep their default behavior.
  if (!href || href.startsWith('#')) return;

  event.preventDefault();

  const target = repoTarget.value;
  const normalized = href.startsWith('https://github.com/')
    ? href.slice('https://github.com'.length)
    : href;
  const wikiPrefix = target ? `/${target.owner}/${target.repo}/wiki/` : '';

  if (target && normalized.toLowerCase().startsWith(wikiPrefix.toLowerCase())) {
    const segment = normalized.slice(wikiPrefix.length).split(/[?#]/)[0] ?? '';
    if (segment && !segment.includes('/') && !segment.startsWith('_')) {
      void selectPage(safeDecodeSlug(segment));
      return;
    }
  }

  window.open(anchor.href, '_blank', 'noopener');
};

const selectPage = async (slug: string) => {
  if (slug === activeSlug.value) return;

  await router.push({
    path: route.path,
    query: {
      ...route.query,
      page: slug === defaultSlug.value ? undefined : slug,
    },
  });
};

const handleRetryPages = async () => {
  await Promise.all([fetchCurrentPages(), fetchCurrentPage()]);
};

const handleRetryPage = async () => {
  await fetchCurrentPage();
};

const handleRepoClick = async () => {
  const target = repoTarget.value;
  if (!target) return;

  await openRepository(target.owner, target.repo);
};

const handleBack = async () => {
  const previousEntry = goBack();

  // Back can land on another child page (another repo's wiki, a releases
  // list, a profile, or a package page).
  const childRoute = buildChildPageRouteFromNavigationEntry(previousEntry);
  if (childRoute) {
    await router.push({ path: localePath(childRoute.path), query: childRoute.query });
    return;
  }

  // Mirror the detail overlay's back handling: rebuild the dashboard query from
  // the popped history entry, falling back to the plain dashboard.
  const query = buildDashboardQueryFromNavigationEntry(previousEntry);
  if (query) {
    await router.push({ path: localePath('/dashboard'), query });
    return;
  }

  await router.push(localePath('/dashboard'));
};

const handleHome = async () => {
  goToHome();
  await router.push(localePath('/dashboard'));
};

onMounted(() => {
  syncNavigationEntry();
  void fetchCurrentPages();
  void fetchCurrentPage();
});

watch([repoFullName, activeSlug], ([newRepo, newSlug], [oldRepo, oldSlug]) => {
  syncNavigationEntry();
  activeTocId.value = '';
  if (newRepo !== oldRepo) {
    void fetchCurrentPages();
  }
  if (newRepo !== oldRepo || newSlug !== oldSlug) {
    void fetchCurrentPage();
  }
});
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('wikiPage.loadingTitle')"
    :loading-subtitle="t('wikiPage.loadingSubtitle')"
    :back-label="t('detailOverlay.back')"
    :home-label="t('detailOverlay.home')"
    :show-home-button="shouldShowHomeButton"
    @back="handleBack"
    @home="handleHome"
  >
    <div class="wiki-page">
      <div class="wiki-page__header">
        <div class="wiki-page__heading">
          <h1 class="title is-5 mb-0 is-flex is-align-items-center">
            <BookOpenIcon :size="18" class="mr-2" aria-hidden="true" />
            {{ t('wikiPage.heading') }}
          </h1>

          <button
            v-if="repoTarget"
            class="wiki-page__repo button is-ghost is-small"
            :title="t('wikiPage.openRepo')"
            @click="handleRepoClick"
          >
            <GitHubIcon :size="15" />
            <span>{{ repoFullName }}</span>
          </button>
        </div>

        <a
          v-if="repoTarget && available"
          class="wiki-page__github-link button is-ghost is-small"
          :href="pageHtmlUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLinkIcon :size="14" />
          <span>{{ t('wikiPage.viewOnGitHub') }}</span>
        </a>
      </div>

      <div class="wiki-page__body">
        <div v-if="!repoTarget" class="wiki-page__empty">
          <p>{{ t('wikiPage.noRepo') }}</p>
        </div>

        <div v-else-if="pagesError" class="notification is-danger is-light wiki-page__error">
          <p class="mb-2">{{ t('wikiPage.error') }}</p>
          <button class="button is-small is-danger is-outlined" @click="handleRetryPages">
            {{ t('wikiPage.retry') }}
          </button>
        </div>

        <div v-else-if="!pagesLoading && !available" class="wiki-page__empty">
          <p>{{ t('wikiPage.unavailable') }}</p>
        </div>

        <div v-else-if="!pagesLoading && pages.length === 0" class="wiki-page__empty">
          <p>{{ t('wikiPage.empty') }}</p>
        </div>

        <div
          v-else
          class="wiki-page__layout"
          :class="{ 'wiki-page__layout--with-toc': tocItems.length }"
        >
          <aside class="wiki-page__sidebar">
            <h2 class="wiki-page__sidebar-title">
              <FileTextIcon :size="14" aria-hidden="true" />
              <span>{{ t('wikiPage.pagesTitle') }}</span>
              <span class="wiki-page__sidebar-count">{{ pages.length }}</span>
            </h2>
            <ul class="wiki-page__sidebar-list">
              <li v-for="entry in pages" :key="entry.slug">
                <button
                  type="button"
                  class="wiki-page__sidebar-item"
                  :class="{ 'is-active': entry.slug === activeSlug }"
                  :title="entry.title"
                  @click="selectPage(entry.slug)"
                >
                  {{ entry.title }}
                </button>
              </li>
            </ul>
          </aside>

          <section ref="contentRef" class="wiki-page__content">
            <div v-if="pageError" class="notification is-danger is-light wiki-page__error">
              <p class="mb-2">{{ t('wikiPage.pageError') }}</p>
              <button class="button is-small is-danger is-outlined" @click="handleRetryPage">
                {{ t('wikiPage.retry') }}
              </button>
            </div>

            <div v-else-if="pageLoading" class="wiki-page__content-loading">
              <Loader2Icon :size="20" class="wiki-page__spinner" />
            </div>

            <template v-else-if="page">
              <h2 class="wiki-page__content-title">{{ activePageTitle }}</h2>

              <MarkdownRenderer
                v-if="page.format === 'markdown' && page.content"
                :value="page.content"
                class="wiki-page__markdown"
              />

              <!-- Sanitized GitHub-rendered body (subdirectory / non-markdown pages). -->
              <div
                v-else-if="htmlSegments.length"
                class="wiki-page__html"
                @click="handleWikiHtmlClick"
              >
                <template v-for="(segment, index) in htmlSegments" :key="index">
                  <AsyncMermaidBlock
                    v-if="segment.type === 'mermaid'"
                    :code="segment.code"
                    class="wiki-page__mermaid"
                  />
                  <div v-else class="wiki-page__html-chunk" v-html="segment.html" />
                </template>
              </div>

              <div v-else class="wiki-page__empty">
                <p class="mb-2">{{ t('wikiPage.pageUnavailable') }}</p>
                <a
                  class="button is-small is-ghost"
                  :href="pageHtmlUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLinkIcon :size="14" class="mr-1" />
                  <span>{{ t('wikiPage.viewOnGitHub') }}</span>
                </a>
              </div>
            </template>
          </section>

          <aside v-if="tocItems.length" class="wiki-page__toc">
            <h2 class="wiki-page__toc-title">
              <ListIcon :size="14" aria-hidden="true" />
              <span>{{ t('wikiPage.toc') }}</span>
            </h2>
            <ul class="wiki-page__toc-list">
              <li v-for="item in tocItems" :key="item.id">
                <button
                  type="button"
                  class="wiki-page__toc-item"
                  :class="{ 'is-active': item.id === activeTocId }"
                  :style="{ paddingLeft: `${0.75 + (item.level - tocMinLevel) * 0.7}rem` }"
                  :title="item.text"
                  @click="scrollToHeading(item.id)"
                >
                  {{ item.text }}
                </button>
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.wiki-page {
  max-width: 76rem;
  margin: 0 auto;
}

.wiki-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.wiki-page__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  min-width: 0;
}

.wiki-page__repo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-muted);
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-text-strong);
  }
}

.wiki-page__github-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--gitpulse-text-muted);
  text-decoration: none;

  &:hover {
    color: var(--gitpulse-text-strong);
  }
}

.wiki-page__error {
  margin-bottom: 1rem;
}

.wiki-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.wiki-page__layout {
  display: grid;
  grid-template-columns: 16rem minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.wiki-page__layout--with-toc {
  grid-template-columns: 16rem minmax(0, 1fr) 16rem;
}

.wiki-page__sidebar {
  position: sticky;
  top: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
  overflow: hidden;
}

.wiki-page__sidebar-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.8rem;
  font-weight: 600;
}

.wiki-page__sidebar-count {
  margin-left: auto;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: var(--gitpulse-surface-hover);
  color: var(--gitpulse-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.wiki-page__sidebar-list {
  max-height: 32rem;
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  overflow-y: auto;
}

.wiki-page__sidebar-item {
  display: block;
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.1s ease,
    color 0.1s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &.is-active {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
    font-weight: 600;
  }
}

.wiki-page__content {
  min-width: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface);
  padding: 1.25rem 1.5rem;
}

.wiki-page__content-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  color: var(--gitpulse-text-muted);
}

.wiki-page__content-title {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 1.25rem;
  font-weight: 600;
}

.wiki-page__html {
  font-size: 0.9rem;
  line-height: 1.65;
  word-break: break-word;

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 1.4em 0 0.6em;
    color: var(--bulma-text-strong, var(--gitpulse-text-strong));
    font-weight: 600;
    line-height: 1.3;
  }

  :deep(h1),
  :deep(h2) {
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--gitpulse-border);
  }

  :deep(h1) {
    font-size: 1.45rem;
  }

  :deep(h2) {
    font-size: 1.25rem;
  }

  :deep(h3) {
    font-size: 1.1rem;
  }

  :deep(p) {
    margin-bottom: 0.85em;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 0.85em 1.5em;
  }

  :deep(ul) {
    list-style: disc;
  }

  :deep(ol) {
    list-style: decimal;
  }

  :deep(li) {
    margin-bottom: 0.25em;
  }

  :deep(pre) {
    margin-bottom: 1em;
    padding: 0.85rem 1rem;
    border-radius: 6px;
    background: var(--gitpulse-surface-muted);
    overflow-x: auto;
    font-size: 0.82rem;
  }

  :deep(code) {
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background: var(--gitpulse-surface-muted);
    font-size: 0.85em;
  }

  :deep(pre code) {
    padding: 0;
    background: transparent;
    font-size: inherit;
  }

  :deep(blockquote) {
    margin: 0 0 1em;
    padding: 0.25em 1em;
    border-left: 3px solid var(--gitpulse-border);
    color: var(--gitpulse-text-muted);
  }

  :deep(table) {
    display: block;
    max-width: 100%;
    margin-bottom: 1em;
    border-collapse: collapse;
    overflow-x: auto;
  }

  :deep(th),
  :deep(td) {
    padding: 0.4em 0.75em;
    border: 1px solid var(--gitpulse-border);
  }

  :deep(th) {
    background: var(--gitpulse-surface-muted);
    font-weight: 600;
  }

  :deep(img) {
    max-width: 100%;
  }

  :deep(hr) {
    margin: 1.5em 0;
    border: 0;
    border-top: 1px solid var(--gitpulse-border);
  }

  :deep(input[type='checkbox']) {
    margin-right: 0.4em;
  }

  .wiki-page__mermaid {
    margin-bottom: 1em;
  }

  /* GitHub alert blocks (> [!WARNING] etc.) keep a light accent. */
  :deep(.markdown-alert) {
    margin-bottom: 1em;
    padding: 0.6em 1em;
    border-left: 3px solid var(--gitpulse-border);
    color: var(--gitpulse-text-muted);
  }

  :deep(.markdown-alert-title) {
    margin-bottom: 0.35em;
    font-weight: 600;
  }

  :deep(.markdown-alert-note) {
    border-left-color: var(--gitpulse-info, #3b82f6);
  }

  :deep(.markdown-alert-tip) {
    border-left-color: var(--gitpulse-success, #10b981);
  }

  :deep(.markdown-alert-important) {
    border-left-color: #8b5cf6;
  }

  :deep(.markdown-alert-warning) {
    border-left-color: var(--gitpulse-warning, #b58a00);
  }

  :deep(.markdown-alert-caution) {
    border-left-color: var(--gitpulse-danger, #ef4444);
  }
}

.wiki-page__toc {
  position: sticky;
  top: 0;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: var(--gitpulse-surface-muted);
  overflow: hidden;
}

.wiki-page__toc-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface);
  color: var(--bulma-text-strong, var(--gitpulse-text-strong));
  font-size: 0.8rem;
  font-weight: 600;
}

.wiki-page__toc-list {
  max-height: 60vh;
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  overflow-y: auto;
}

.wiki-page__toc-item {
  display: block;
  width: 100%;
  padding: 0.3rem 0.75rem;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.75rem;
  text-align: left;
  line-height: 1.4;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition:
    background 0.1s ease,
    color 0.1s ease,
    border-color 0.1s ease;

  &:hover {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &.is-active {
    border-left-color: var(--gitpulse-accent, #3b82f6);
    color: var(--gitpulse-text-strong);
    font-weight: 600;
  }
}

.wiki-page__spinner {
  animation: wiki-page-spin 1s linear infinite;
}

@keyframes wiki-page-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1215px) {
  .wiki-page__layout--with-toc {
    grid-template-columns: 16rem minmax(0, 1fr);
  }

  .wiki-page__toc {
    display: none;
  }
}

@media (max-width: 768px) {
  .wiki-page__layout,
  .wiki-page__layout--with-toc {
    grid-template-columns: 1fr;
  }

  .wiki-page__sidebar {
    position: static;
  }

  .wiki-page__sidebar-list {
    max-height: 16rem;
  }
}
</style>
