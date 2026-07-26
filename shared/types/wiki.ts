/**
 * Repository wiki payloads served by the `/api/repos/{owner}/{repo}/wiki/*`
 * routes. GitHub has no wiki REST API: the page list is parsed from the public
 * wiki HTML and page bodies come from `raw.githubusercontent.com/wiki/...`,
 * so only public wikis are readable.
 */

/** One entry of the wiki page list sidebar. */
export interface WikiPageSummary {
  /** Decoded page slug — the wiki file base name (e.g. `Command-Line-Arguments`). */
  slug: string;
  /** Human-readable page title as shown in the wiki sidebar. */
  title: string;
}

export interface WikiPageListResponse {
  /** False when the repository has no publicly readable wiki. */
  available: boolean;
  pages: WikiPageSummary[];
  htmlUrl: string;
}

/**
 * `markdown` is the raw wiki file; `html` is GitHub's rendered body, used
 * when the raw fetch misses (files in subdirectories, non-markdown markup).
 */
export type WikiPageContentFormat = 'markdown' | 'html';

export interface WikiPageContentResponse {
  slug: string;
  /** Page body in `format`, or null when the page is missing entirely. */
  content: string | null;
  format: WikiPageContentFormat | null;
  htmlUrl: string;
}
