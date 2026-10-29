---
status: accepted
---

# Discovery owns pagination and preserves the Follows browsing position

Search and Starred are two sources of Repository Discovery, with the same page
turn, retry, refresh, and cache semantics. Their independent implementations and
page-level reconstruction of those decisions caused ordinary navigation to
reload page one and retained search text to select the wrong source. One
discovery session now owns both sources' pagination, visited-page caches, and
Follows Browsing Positions. Release Follows remains the sole confirmation
authority for membership under ADR 0021; discovery candidates cannot establish
or restore a follow.

Retain the last selected source and each source's page and reading repository
within the current account/backend session and application run. Ordinary returns
reuse these results. Selecting a page explicitly always starts that page at the
top, even on a cache hit; an explicit refresh fetches only the current page and
starts it at the top when the response arrives. New search conditions or Starred
ordering replace that source's page cache and start at page one. Cached discovery
is neither a durable offline snapshot nor a device preference. This accepts
changes from another client remaining unseen until explicit refresh in exchange
for predictable reading and navigation.

Keep numbered pagination with a first-page action, previous and next actions,
and one page indicator with a persistent pencil glyph. Tapping the indicator
replaces its entire contents with a selected numeric input; its total and pencil
return after submission or focus loss. The indicator reserves the same size in
both states. Unknown totals name only the current page. This preserves direct
entry without keeping an input and a separate total side by side, while the
pencil and filled surface make editing discoverable.

This supersedes ADR 0026's shared border, cell dividers, and 32dp pill exception.
The new footer uses the existing compact control floor, grows for larger text,
and retains the management entry. Remove the obsolete Pill implementation and
its geometry tokens rather than retaining an unused control family.
