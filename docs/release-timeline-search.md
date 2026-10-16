# Release Timeline Search design

Status: field selection and matching rules confirmed during the design interview.
Implementation has not been requested.

## Confirmed

- Default search fields are repository `owner/name`, release title, and tag.
- An explicit "Include release notes" option is off by default. Enabling it adds the
  full release notes to those fields.
- Release notes are optional because common words and references to other projects
  can produce many incidental matches, making everyday project and version lookup noisy.
- Search is limited to releases exposed in the current Shared Timeline Window. Typing
  a query does not load history or search buffered releases outside that window; explicitly
  loading older history expands the search scope. Empty results must state that the search
  is limited to the currently loaded window.
- Matching releases retain publication-time descending order and existing date grouping.
  Search does not rank results by relevance or assign field weights for sorting.
- Split a multi-term query into terms that must all match the same release (AND).
  Each term may match any enabled field (OR across fields), allowing repository identity
  to match one term and the title, tag, or enabled release notes to match another.
- Ordinary query terms are split on whitespace, matched case-insensitively as literal
  substrings, and retain punctuation. Their order does not matter. A contiguous Chinese
  query is one substring; whitespace separates independent Chinese terms. For example,
  `react` can also match `preact`, while `node.js` remains one term.
- The first version does not perform typo correction, synonym expansion, or semantic search.
- Release-note search uses readable text and code, excluding link destination URLs,
  image source URLs, and HTML tags. A configuration identifier in a code block is searchable;
  a word appearing only in a Markdown link destination is not.
- Version-like queries such as `3.12` and `v3.12` must not match by cutting through an
  adjacent digit. `3.12` matches `v3.12.0`, but not `3.120` or `13.12`. An explicitly
  entered `v` remains literal. Do not interpret semantic-version range expressions.
- Double quotes form a contiguous phrase that must match within one enabled field.
  Phrases participate in the same AND rule as ordinary terms. Normalize consecutive
  whitespace within phrases and searchable fields. An unclosed quote extends to the
  end of the query while the user is typing. Double-quoted phrases are the only special
  query syntax in the first version.
- Allow single-character queries, including a single Chinese character or `R` and `C`.
  Do not remove stop words or impose a minimum query length. A whitespace-only query
  applies no text restriction.

## Matching algorithm

For each release already exposed in the current window:

1. Apply the existing repository, date, and prerelease filters.
2. Select repository `owner/name`, title, and tag as searchable fields. Include release-note
   text only when the user enables it.
3. Compare normalized fields against parsed query terms and phrases. Every term or phrase
   must match at least one enabled field on this same release. Use literal substring matching,
   with the numeric-boundary rule for version-like queries.
4. Retain matching releases in their existing publication order and omit empty date groups.

In boolean notation: `existingFilters(release) AND every(queryPart, some(enabledField, match))`.
An empty query makes the text predicate true.

## Examples

| Query                     | Enabled fields / contents                                          | Result                                |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `nuxt 3.12`               | Repository `nuxt/nuxt`, tag `v3.12.0`                              | Match across fields                   |
| `nuxt 3.12`               | Repository `nuxt/nuxt`, tag `v3.120.0`, no other version match     | No match                              |
| `nuxt hydration`          | Repository contains `nuxt`, only release notes contain `hydration` | Match only with release notes enabled |
| `nuxt "breaking changes"` | Repository contains `nuxt`, notes contain the contiguous phrase    | Match only with release notes enabled |
| `react`                   | Repository name `preact`                                           | Match under substring semantics       |
| `AUTH_TOKEN`              | Only a release-note code block contains the identifier             | Match only with release notes enabled |
| `example.com`             | Appears only in a Markdown link destination                        | No match from that destination        |

## Implementation recommendations

These are engineering recommendations, rather than additional product decisions:

- Start with a local boolean matcher. Relevance scoring, fuzzy search, a search service,
  and an inverted index are not prerequisites for the agreed behavior.
- Prepare normalized searchable text when release data changes, rather than reparsing
  every release's Markdown on every keystroke. Keep the card's truncated preview separate
  from full search text, keyed by repository and release identity.
- Keep the current exposed window as the candidate set even if pagination state contains
  older buffered records. Search must not change pagination or recovery detection.
- Measure input latency with realistic follow counts and long release notes before adding
  further performance machinery. Existing full descriptions avoid additional detail requests,
  but normalization and cached search text still consume CPU and memory.
- A body match may lie beyond the card preview. A contextual match excerpt is recommended
  so the user can understand why that release is included.

## Current implementation facts (before this change)

- `app/utils/filterReleaseTimelineGroups.ts` currently performs a case-insensitive
  contiguous substring match on the title only.
- Timeline cards retain the first 500 UTF-16 code units of release notes, while the
  client pagination state retains the full description. Full-text matching for releases
  already loaded does not require a separate GitHub detail request per release.
- Current search filters the exposed Shared Timeline Window. Pagination state may
  also contain buffered releases outside that window; these are distinct search scopes.

## Outside this analysis

The implementation task still needs to choose placement and persistence of the release-notes
option and the visual presentation of body matches. These UI details are outside this request's
field-selection and matching-algorithm scope; the excerpt above is a recommendation.

The existing window and pagination constraints are recorded in
[ADR 0011](./adr/0011-release-timeline-pagination-and-refresh-baseline.md).
