---
status: accepted
---

# The Repository Release List is one shared three-band surface

The Repository Release List is one presentation hosted twice — the fullscreen repository page and the
Release Drawer — and it owns its own vertical layout: a fixed filter bar, an expanded lazily built
list, and a pager band at the bottom edge. A host supplies only its chrome and safe area and must not
wrap the list in a scroll view. The Release Drawer hands the sheet's own scroll controller down to the
list, so dragging the rows still moves the sheet exactly as dragging the notes does.

The repository name belongs to the host chrome, not to the list. The drawer's chrome line already
names the repository being read, and the fullscreen page names it in its app bar in place of the
generic "Repository releases" title. A list that repeats the name is one line the reader pays for
twice; a future reader should not add it back as a heading, not even "for the fullscreen page only".

A row is two lines: the release's name, then one muted meta line. That line is glyph-led rather than
prose: a calendar glyph with the day, a paper clip with the asset count, and a download arrow with the
compact download count. The nouns the glyphs replace ("assets", "downloads") move onto each fact's
semantics label, so the visible line carries no repeated wording while a screen reader still hears the
units. An Entry Release is marked by a 4dp accent bar on the leading edge carrying a semantics label,
never by a third line of text.

A release's **Release State** is one badge beside the name: `GitPulseStatusBadge` from the shared
presentation layer, the same pill the Settings backend card draws — a hairline outline, no fill, a
14dp glyph and the state's own word. A draft reads as Draft even when GitHub also marks it a
prerelease, because this list's filter never files a draft under prereleases and a row must not
contradict the filter that produced it. The badge keeps its own width and the name yields to it, so a
row at any text scale loses characters of the name rather than its state or its way forward; the pill
shrinks only by the name's ellipsis, never by its own. The status pill is told apart from the filter
pills below it by shape rather than by colour: it takes `GitPulseRadius.surface` (12dp) while every
pill that answers a press takes `GitPulseRadius.row` (8dp), and it stays under the 40dp control floor
because nothing about it is tappable.

The tag a release is addressed by is no longer printed beside its name, even when the two differ. A
tag is an address rather than a fact about the release: the Release Drawer's chrome row names the tag
of the release it opened, and a row that printed it in monospace paid a line of width for it on every
release whose name differed. The tag line existed in the first version of this surface and is not to
be restored as "just the tag" or "only when it differs".

The three facts are columns, not a flowing sentence. Their widths are measured from the values about to
be drawn — once per page, before any row is built — so the calendar, paper-clip and download glyphs
land on the same x down the whole list even when the dates differ in width, and a date-less row leaves
its column empty rather than shifting its neighbours. Measuring rather than hard-coding keeps the
columns right in every language and at every text scale; each column is capped at a third of the line,
so a large text scale wraps a value inside its column instead of pushing a column off the row.

Typography stays on Material's semantic text roles — `titleSmall` for the name, `labelSmall` for the
meta line, `labelMedium` for a filter pill and `bodySmall` for the pager — with exactly one
attribute-level override left: tabular figures on the numeric meta, so the day, asset count and
download count line up down the page. (The tag's monospace was the other one, and it left with the
tag.) Every role here sits one step below the size this surface held while a tag shared the title
line: the list is scanned, and the drawer a row opens carries the same release at full size.

The distances follow the type rather than the other way round. A row's vertical inset is 8dp and the
gap under the name is 2dp, because smaller type in the old padding reads as small text floating in
empty space. A filter pill's padding grows as its label shrinks, so the chip keeps the 36dp height it
had. A Release State badge is only as tall as the line it sits on, so a row that carries one is
exactly as tall as a row that does not — the row heights in one list never disagree.

Each fact's glyph is a 14dp Material icon in the muted tone, so the line is scanned by shape before it
is read. Do not grow this into a per-surface size system; a second override needs the same kind of
justification.

Filters are one horizontally scrollable row of label-only pills, the selected one filled with the
scheme's `secondaryContainer`. There is no check mark, no outline and no permanent sentence about
filtering being page-scoped. Four filters do not fit a 397dp drawer panel in every language, and
scrolling the row is the accepted cost of keeping it one row high; the page-scoped nature of the
filter remains a behaviour rather than a caption.

The pager reports the current page, disables its arrows at the edges, and disappears when the loaded
page is both the first and the last. It is part of the surface, not the end of the list, so changing
page never means scrolling past the releases. Loading and failure fill the list band only: the filter
bar stays where it is, and the pager stays hidden while it cannot move. An empty band normally has no
pager either, because the loaded page is the only page — but a page a filter emptied while other
pages exist keeps its pager. The filter only sees the current page, so removing the arrows would
strand the reader on a page with nothing to read and no way forward; that is why the pager's
visibility follows the pagination, not the number of rows the filter left.

Two formatters live in the presentation formatting layer with the existing date and byte-size
formatters: a month-and-day formatter that appends the year only when the instant falls outside the
current year — the current year is a parameter so unit tests never depend on the clock — and a compact
count formatter for download counts (`1.2k`, `12k`, `1m`). The magnitude letters stay ASCII in every
language, as GitHub prints them: a Chinese reader reads `1.2k` as the same number a reader of English
does, while a locale-specific magnitude such as `万` would change the number rather than translate
it. Count strings still flow through the localisation files, which receive the already-formatted
compact string; the raw count only selects the singular, so one download does not read as
"1 downloads".

## Consequences

- This reverses ADR 0012's sentence that the drawer "uses a presentation made for that drawer". The
  concept ADR 0012 fixes — Entry Release, Repository Release List, one-step return, page 1 newest
  first, page and filter retained — is untouched.
- Both hosts lose the safety of wrapping the list in their own scroll view: the list requires a
  bounded height and will assert in a host that does not give it one.
- Rows no longer show the asset count placeholders from the old subtitle or the "Entry Release" text;
  the filter bar and the accent bar carry that information now.
- This reverses the first version of this ADR on Release State: the draft or prerelease state was left
  to the filter bar, and a reader who never used filters lost the per-row marker "by design". The
  badge is back, because a draft is invisible to everyone but its author and a prerelease is not the
  version most readers want to install, and a filter bar cannot say either thing about the row in
  front of the reader.
- A reader loses the exact tag of a release without opening it. The Release Drawer's chrome row still
  names it, and this surface trades that for the name having the whole title line.
- The shared `GitPulseStatusBadge` becomes the one shape for a state in the app, which leaves ADR 0019
  and ADR 0023 without the filled badge they once described; both files record that the rule outlived
  its instance.
- The download count is shown where it was already fetched, so no server or payload change is
  involved.
- Compact counts trade exactness for a short row: a reader who needs the precise number opens the
  release, and counts under a thousand keep their own digits.
- The meta line is one line by default and its facts share measured columns, so the row is a small
  table rather than a sentence. Adding another fact still pushes the download count out of a 360dp
  row, so new meta content means deciding what leaves; only a large text scale wraps a value inside
  its column.
