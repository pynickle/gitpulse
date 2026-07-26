import type {
  WikiPageContentResponse,
  WikiPageListResponse,
  WikiPageSummary,
} from '#shared/types/wiki';

export function useRepoWiki() {
  const apiFetch = useGitPulseApiFetch();

  const pages = ref<WikiPageSummary[]>([]);
  const available = ref(true);
  const wikiHtmlUrl = ref('');
  const pagesLoading = ref(true);
  const pagesError = ref<string | null>(null);
  const activePagesRequestId = ref(0);

  const page = ref<WikiPageContentResponse | null>(null);
  const pageLoading = ref(true);
  const pageError = ref<string | null>(null);
  const activePageRequestId = ref(0);

  const fetchPages = async (owner: string, repo: string) => {
    const requestId = activePagesRequestId.value + 1;
    activePagesRequestId.value = requestId;
    pagesLoading.value = true;
    pagesError.value = null;

    try {
      const data = await apiFetch<WikiPageListResponse>(`/api/repos/${owner}/${repo}/wiki/pages`);
      if (requestId !== activePagesRequestId.value) return;

      pages.value = data.pages;
      available.value = data.available;
      wikiHtmlUrl.value = data.htmlUrl;
    } catch (err) {
      if (requestId !== activePagesRequestId.value) return;

      pagesError.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activePagesRequestId.value) {
        pagesLoading.value = false;
      }
    }
  };

  const fetchPage = async (owner: string, repo: string, slug: string) => {
    const requestId = activePageRequestId.value + 1;
    activePageRequestId.value = requestId;
    pageLoading.value = true;
    pageError.value = null;

    try {
      const data = await apiFetch<WikiPageContentResponse>(
        `/api/repos/${owner}/${repo}/wiki/page?name=${encodeURIComponent(slug)}`
      );
      if (requestId !== activePageRequestId.value) return;

      page.value = data;
    } catch (err) {
      if (requestId !== activePageRequestId.value) return;

      pageError.value = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      if (requestId === activePageRequestId.value) {
        pageLoading.value = false;
      }
    }
  };

  return {
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
  };
}
