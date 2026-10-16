## Problem Statement

Release Timeline Search currently matches only a release title using one case-insensitive
contiguous substring. Users cannot reliably locate releases by Followed Repository or Tag
when that information is absent from the title, or combine a project name with a version.
Some users also need to find the release that introduced a feature or fixed a problem.
Always searching release notes would create incidental matches from common words and
references to other projects, making everyday project and version lookup noisy.

The Release Timeline exposes a bounded Shared Timeline Window, which is not a guarantee
of complete historical coverage. Search results must make that scope understandable.

## Solution

Search repository `owner/name`, release title, and Tag by default. Provide an explicit
"Include release notes" option that is off by default and adds full release-note text.
All query terms must match the same release, but may match different enabled fields.
Support literal substring matching, quoted phrases, and numeric boundaries for version-like
queries while preserving publication-time descending order and date grouping.

Search only releases exposed in the current Shared Timeline Window. Typing or changing
search options does not load history. Explicitly loading older history expands the search
scope, and an empty result states that nothing matched in the currently loaded range.

## User Stories

1. As a Release Timeline user, I want to search by repository name, so that I can find a project's releases even when its name is absent from release titles.
2. As a Release Timeline user, I want to search by repository owner or full owner/name identity, so that I can distinguish projects with similar names.
3. As a Release Timeline user, I want to continue searching release titles, so that existing title-based lookup remains available.
4. As a Release Timeline user, I want to search a Tag independently of the title, so that I can find a version whose release has a descriptive title.
5. As a Release Timeline user, I want release notes excluded by default, so that incidental mentions of other projects do not overwhelm project lookup.
6. As a Release Timeline user, I want to explicitly include release notes, so that I can find releases mentioning a feature, fix, or configuration setting.
7. As a Release Timeline user, I want enabled note search to cover the full notes of exposed releases, so that a match beyond the card preview is still found.
8. As a Release Timeline user, I want all entered terms to be required, so that adding a term narrows the result set.
9. As a Release Timeline user, I want terms to match across fields on the same release, so that a repository name and a version can identify one result together.
10. As a Release Timeline user, I want terms from different releases never to be combined into a match, so that every returned release satisfies my complete query.
11. As a Release Timeline user, I want search to ignore letter case, so that capitalization does not prevent a match.
12. As a Release Timeline user, I want leading, trailing, and repeated query whitespace handled consistently, so that incidental spacing does not change ordinary term matching.
13. As a Release Timeline user, I want punctuation retained in names and identifiers, so that queries such as node.js and AUTH_TOKEN preserve their meaning.
14. As a Release Timeline user, I want ordinary terms to match substrings, so that I can locate a name without entering its complete spelling.
15. As a Release Timeline user, I want a contiguous Chinese query treated as a literal fragment, so that matching does not depend on an undisclosed word-segmentation dictionary.
16. As a Release Timeline user, I want whitespace-separated Chinese fragments to be independent required terms, so that I can narrow a Chinese query.
17. As a Release Timeline user, I want version queries not to cut through adjacent digits, so that 3.12 does not accidentally return 3.120 or 13.12.
18. As a Release Timeline user, I want a version-series query such as 3.12 to match v3.12.0, so that I can find releases in that series.
19. As a Release Timeline user, I want an explicitly entered v prefix to remain literal, so that the system does not silently rewrite my query.
20. As a Release Timeline user, I want double quotes to require a contiguous phrase in one field, so that I can distinguish a phrase from scattered words.
21. As a Release Timeline user, I want a phrase to combine with other required terms, so that I can search a project together with a specific phrase from its notes.
22. As a Release Timeline user, I want an unfinished quoted phrase to remain usable while typing, so that results do not disappear solely because I have not entered the closing quote yet.
23. As a Release Timeline user, I want single-character searches supported, so that a Chinese character or short project name such as R or C remains searchable.
24. As a Release Timeline user, I want common words retained as query terms, so that the system does not silently ignore part of my request.
25. As a Release Timeline user, I want an empty or whitespace-only query to remove only the text restriction, so that other active filters continue to apply.
26. As a Release Timeline user, I want note searches to include readable text and code, so that configuration identifiers and code examples can be found.
27. As a Release Timeline user, I want link destinations, image source addresses, and HTML tags excluded from note search, so that invisible markup does not create incidental results.
28. As a Release Timeline user, I want matching releases to remain ordered by publication time and grouped by date, so that the timeline retains its browsing meaning.
29. As a Release Timeline user, I want repository, date, and prerelease filters to combine with search, so that I can further narrow results.
30. As a Release Timeline user, I want search to stay within the exposed window without additional fetches, so that typing does not initiate an unexpected historical scan.
31. As a Release Timeline user, I want an explicit older-history load to expand searchable results, so that I can continue looking further back deliberately.
32. As a Release Timeline user, I want empty results to identify the currently loaded scope, so that I do not mistake them for proof that no matching release exists anywhere in history.
33. As a Release Timeline user, I want existing partial-coverage information and history-loading actions to remain available, so that a filtered or empty list does not hide missing data or prevent further loading.

## Implementation Decisions

- Extend the existing Release Timeline display-filter contract and its session integration.
  Keep one owner of query semantics; do not duplicate matching in presentation components.
- Default searchable fields are repository owner/name, the existing display title, and the
  separate Tag. Preserve the existing title fallback when a release has no nonblank name.
- Represent "Include release notes" as explicit search state, off by default. It adds notes
  without removing the default fields or changing the query's AND semantics.
- Parse ordinary terms on whitespace. Lowercase query and searchable text consistently,
  normalize consecutive whitespace, retain punctuation, and match ordinary terms as literal
  substrings in any order. A contiguous Chinese fragment remains one term. Ordinary substring
  semantics intentionally allow react to match preact.
- Treat double-quoted text as one contiguous phrase within a single enabled field. Normalize
  internal whitespace in both the phrase and field. An unclosed quote extends to query end.
  Phrases and ordinary terms are ANDed; each may match a different field on the same release.
- For version-like terms such as 3.12 and v3.12, reject occurrences that match by cutting
  through an adjacent digit. Thus 3.12 matches v3.12.0, but not 3.120 or 13.12. Preserve an
  explicitly entered v literally. Do not interpret version ranges. This is a matching rule,
  not a semantic-version resolver.
- Do not drop stop words or require a minimum query length. A query with no text after
  whitespace trimming applies no text restriction.
- Build release-note search text from readable text and code; exclude link destination URLs,
  image source URLs, and HTML tags. A link label can match; its hidden destination cannot.
  Search extraction must respect the existing sanitization boundary for any displayed text.
- Use full descriptions already retained in client pagination state. Card previews contain
  only the first 500 UTF-16 code units and cannot serve as the full-text search source.
  Associate searchable notes with repository and release identity, avoiding cross-repository
  numeric-ID collisions. Do not add per-release detail requests for search.
- Prepare normalized fields and Markdown-derived note text when their source data changes,
  rather than reparsing every description for each keystroke. Release or invalidate prepared
  data with its owning session/account context so stale text cannot affect another session.
- Candidate releases come exclusively from the exposed Shared Timeline Window, even when
  pagination state retains older buffered releases. Search does not advance cursors, alter
  the shared boundary, refresh data, or change Recovered Release detection.
- Combine text matching with existing repository, local published-date, and prerelease filters
  using AND. Keep existing publication ordering, tie handling, and date grouping; remove empty
  groups after filtering. Preserve existing loaded-new-count semantics using the resulting
  visible releases, and keep Recovered Release History independent of the main-list search.
- Preserve partial-coverage information and the ability to load older history when no visible
  releases match. Empty-result copy must describe the currently loaded scope.
- Start with a local boolean matcher. No field weights or relevance ranking are needed for
  the agreed chronological result order. Measure realistic workloads before adding further
  performance machinery; no numeric latency target was agreed.
- Control placement and persistence were not settled in the design interview. Follow existing
  search-control conventions and keep the option off initially; this spec does not require a
  new persistent preference or storage/API schema.

## Testing Decisions

- Confirmed primary acceptance seam: the existing public Release Timeline session, driven
  through its filter input, injected repository-page responses, and public loading actions.
  Assert visible release identities, order, date groups, loaded-new counts, exposed coverage,
  and adapter request counts. This is the highest existing seam that can verify both matching
  and the current-window/no-fetch contract together.
- Follow the existing Release Timeline lifecycle suite's harness, which supplies deferred
  repository-page responses and observes session output through real Vue reactivity. Extend
  that harness as needed rather than creating a second session coordinator or synthetic
  test-only search pipeline.
- Use table-driven acceptance cases for all default fields, cross-field AND, same-release
  isolation, case and whitespace, punctuation, substring behavior, Chinese fragments, single
  characters, empty queries, numeric version boundaries, phrases, and unfinished quotes.
- Cover note search off and on; matches after the 500-code-unit preview boundary; readable
  link labels; excluded link/image destinations and tags; searchable code blocks; absent notes;
  and identical numeric release IDs in different repositories.
- Cover search combined with repository/date/prerelease filters, publication order and date
  groups, loaded-new counts, exposed versus buffered matches, explicit older-history loads,
  partial repository failures, refreshes, and account/session changes that must not reuse stale
  prepared text. Assert that query edits and note-option changes issue no additional requests.
- Existing pure display-filter tests provide prior art for matching, identity preservation,
  empty-group cleanup, and AND composition. Replace their obsolete title-only expectations
  for repository and Tag matching; retain coverage of existing filter behavior. Add focused
  cases there only when they add diagnostic value rather than duplicate the session matrix.
- Good tests exercise public behavior and outputs. Do not assert helper call sequences,
  private cache layout, source text, parser internals, or arbitrary timing thresholds.
- If a small mounted-component test is needed to verify the notes option drives search state
  and exposes loaded-scope empty copy, use the existing Vue DOM test infrastructure. Do not
  replace the session acceptance tests with mocked matching logic.
- Implementation verification must include root behavior tests, lint, Nuxt typecheck, and
  formatting checks. Do not run a local production build. Real-browser testing requires an
  explicit user request; it is not part of this specification task.

## Out of Scope

- Searching all historical releases, automatically scanning more pages, or exposing buffered
  releases before their Shared Timeline Window becomes visible.
- Changing timeline pagination, refresh baselines, recovery persistence, or coverage guarantees.
- Relevance sorting, weighted ranking, typo correction, stemming, synonyms, semantic search,
  and adding a search backend or mandatory inverted index.
- Semantic-version ranges, Boolean query operators, field qualifiers, or special query syntax
  beyond double-quoted phrases.
- Searching release authors, asset filenames, arbitrary URLs, dates as text, or status as text.
- Extending search to the Repository Release List, Release Drawer lists, or Recovered Release
  History. These are distinct surfaces.
- A new permanent preference or API/storage contract for the release-notes option.
- Redesigning the search UI, specifying exact control placement, or prescribing the visual
  design of contextual match excerpts.

## Further Notes

The field-selection and matching rules above were agreed during the design interview.
The user confirmed the testing boundaries before issue publication.

Existing pagination decisions distinguish a Shared Timeline Window from complete historical
coverage. A window can be partial, and even successful participation by every Followed
Repository does not prove completeness. Search must preserve this distinction.

A contextual excerpt for a note-only match is recommended, especially when the match is beyond
the card preview, but its visual design was not agreed and is not an acceptance requirement.

This spec requests implementation of Release Timeline Search. Producing this spec does not
itself change the application's current title-only search.
