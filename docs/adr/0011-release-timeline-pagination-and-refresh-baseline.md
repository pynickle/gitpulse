---
status: proposed
---

# Coordinate Release Timeline pagination across Followed Repositories

Loading a fixed number of releases independently from each Followed Repository can expose older
dates before every repository's history for those dates is available. Release Timeline history
will load in coordinated rounds, each requesting up to 100 releases per repository, with explicit
user action to continue into older history. GitHub's connection limit applies per repository;
a round can use multiple GraphQL requests to stay within query resource limits.

The following product decisions have been agreed during the design interview:

- Each round advances every Followed Repository that still has history to load, rather than
  advancing only the repository that first reaches the visible boundary.
- A refresh restarts pagination from the first page for each Followed Repository.
- Repository failures allow successful results to be displayed. The UI must identify missing
  repositories and distinguish partial coverage from participation by every Followed Repository.
  Even successful participation by every repository is not a strict completeness guarantee.
- A persistent Timeline Refresh Baseline represents the previous refresh that returned usable
  results. It advances even when some repositories failed, accepting that those repositories'
  releases may be undercounted as new on a later refresh. It is used for a marker and a
  new-release count, and is not a record of which releases the user has read.
- User-visible timeline dates and ordering use publication time (`publishedAt`), matching the
  publication-date semantics shown on GitHub's release cards.
- Bounded pagination takes precedence over a strict publication-time completeness guarantee.
  An older draft published later may initially be missed because GitHub pages by creation time.
  When subsequent loading discovers a release belonging to an interval already shown, merge it
  into its chronological position and expose it separately as a Recovered Release so the user
  can inspect omissions without searching earlier timeline cards.
- Recovered Release History persists across refreshes until the user explicitly clears it.
  It is separate from a count of new releases and does not represent unread status.
  Clearing it marks its releases as handled permanently: the same repository/release identity
  cannot be added again, although the release can still appear normally on the timeline.
- The visible history boundary uses an exact publication timestamp. The boundary day may be
  partially displayed; users do not need to load a complete day before its releases can appear.
- Display the count as loaded new releases, not as a complete total. Additional pages and
  Recovered Releases can increase the count when their publication times are newer than the
  previous Timeline Refresh Baseline. Do not scan extra history solely to obtain a total.
- The loaded new-release count follows the Active Timeline Filter. Recovered Release History
  is an independent list showing all retained records rather than inheriting the main filter.

GitHub's [Releases page documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/viewing-your-repositorys-releases-and-tags)
does not specify its internal ordering field. Selecting publication time for GitPulse does not
establish that GitHub's website uses that field to paginate. The
[GraphQL release connection](https://docs.github.com/en/graphql/reference/releases#releaseorderfield)
supports ordering by `CREATED_AT` or `NAME`, not by `publishedAt`; bounded pages therefore do not
prove that every more recently published release has already been retrieved.

## Pagination and recovery contract

The pagination module owns the current refresh cycle, repository cursors and exhaustion states,
accumulated releases, display boundary, failures, and the previous baseline used for counting.
Its interface exposes refresh, load older history, and retry failed pages. Presentation code
consumes its result instead of independently coordinating repository pages or recording history.

- Use each repository's own `endCursor` with `after`. A successful page advances only that
  repository; a failed page keeps its previous cursor. Skip exhausted repositories.
- Each normal load requests the next page for every repository that still has history. Split
  GraphQL operations as needed for query limits; one user action is one coordinated round.
- For each successful repository that still has older history, use the earliest publication
  time among all of its releases fetched during the current cycle. The shared boundary is
  the latest of these times. Retain older fetched records as a buffer; expose them as the
  boundary advances. Repositories with exhausted history do not constrain the boundary.
- Compute this boundary before applying the Active Timeline Filter. A filter must not prevent
  loading older history when it hides all currently visible cards.
- A failed repository does not block other repositories from extending a partial window.
  Preserve its existing data and cursor, and retry the failed page without restarting history.
  Once a window has been exposed, do not hide its cards because a recovered repository has
  not yet caught up; keep the window marked partial while its coverage is behind.
- A page with no displayable releases does not imply exhaustion. Keep loading available while
  `hasNextPage` is true, including when no finite boundary can yet be derived. Do not silently
  skip through additional pages beyond the user-requested round. If a repository has no usable
  publication timestamp yet, available peer results can be shown with partial coverage.
- Identify releases by repository ID and release ID. A release first discovered during a later
  page or retry is recovered if its publication time is at or newer than the oldest timestamp
  exposed before that operation. An operation with no previously exposed interval cannot discover
  a recovery. Previously fetched buffered records are not recovered when revealed.
- Insert recovered records in publication order, preserve the current visible card and scroll
  offset, and offer them through a dedicated history entry. Main-list filtering must not
  determine whether an omission is recorded.
- A refresh resets pagination and the interval used to detect new omissions. Detection is
  scoped to that cycle; permanent history does not require comparing newly refreshed results
  with every release displayed in previous cycles.

## Refresh baseline and loaded count

A new cycle captures its previous persistent baseline and keeps that value fixed for the cycle.
Use a server timestamp captured before the refresh request's GitHub reads as the next baseline,
persisted after usable results return. Partial results advance it; an entirely failed refresh
does not, even if its transport response has HTTP status 200. Loading older pages and retrying
failed pages do not advance the baseline.

Count distinct currently exposed releases newer than the cycle's previous baseline after applying
the Active Timeline Filter. Recompute on filtering, loading, and recovery; label it as loaded new
releases. A recovered release can also count as new. Until a baseline exists, the first load
establishes one without labelling the fetched history as new.

Show the previous refresh marker at its publication-time position when that position is exposed.
If it is outside the loaded window, show its timestamp without implying that the user has already
loaded or read down to it. Returning to a cached tab resumes the same cycle; an explicit refresh
or a browser reload starts a new one. Changing the followed set invalidates the current cycle.

## Permanent recovered history

Store per-user release timeline data independently of the full preferences object, reusing the
existing filesystem, Redis, or Upstash configuration and account isolation. Its module owns the
refresh baseline, retained recovery snapshots, and handled identities. Avoid sending the full
growing history through ordinary settings reads and writes.

Keep the card summary, repository identity, release identity, publication time, URL, and discovery
time for each recovered release. Fetch full release details when opening the existing Release
Drawer. Summaries remain inspectable after a repository is unfollowed or a release becomes
unavailable. Do not expire or silently evict retained records.

The dedicated history list shows all retained records and can load them in pages without being
limited by the main timeline's current history window or filters. Clearing it removes the current
snapshots and permanently marks those identities as handled. Check handled identities during
every later merge so an in-flight request cannot restore cleared records. Other records discovered
after the clear can still be added. Clearing history does not hide releases from the main timeline
or change the refresh baseline.

All persistent mutations use authenticated mutating routes and the existing CSRF-protected fetch
path. Reads do not advance the baseline or clear records. Use atomic per-user updates and discard
obsolete account/cycle results; report persistence failures so a successful timeline fetch cannot
silently pretend that its permanent state was saved.

## Verification

Exercise the module interfaces with repository pages that have different release frequencies,
independent cursors, exhausted or empty pages, equal timestamps, and late publication of old drafts.
Verify buffered records are revealed without entering recovery history, while newly discovered
records in an already exposed interval are inserted, retained, and deduplicated correctly.

Cover partial failure and targeted retry, entirely failed refreshes with HTTP 200, fixed counting
baselines within a cycle, filtered loaded counts, first use, cached returns, follow-set changes,
and obsolete responses. Verify independent recovery history, retained summaries after unfollowing,
clear suppression across refreshes, and clear/merge concurrency through the storage interface.

Verify grid anchoring through the real virtual-row layout after insertion. Run formatting, root
tests, lint, and Nuxt typecheck. Browser testing is outside this request unless explicitly asked.
