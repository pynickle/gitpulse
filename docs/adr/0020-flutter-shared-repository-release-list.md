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

A row is two lines: the release's name (or its tag when the name is empty after trimming), then one
muted meta line. That line is glyph-led rather than prose: the tag — only when it differs from the
name — then a calendar glyph with the day, a paper clip with the asset count, and a download arrow
with the compact download count. The nouns the glyphs replace ("assets", "downloads") move onto each
fact's semantics label, so the visible line carries no repeated wording while a screen reader still
hears the units. An Entry Release is marked by a 4dp accent bar on the leading edge carrying a
semantics label, never by a third line of text. The tag ellipsises when the line is tight; the glyph
facts keep their width, and a reader with a large text scale gets the facts wrapped onto a second meta
line rather than clipped or dropped. The draft or prerelease state of a release is left to the filter
bar, which is where a reader selects for it anyway.

Typography stays on Material's semantic text roles — `titleMedium` for the name and `bodySmall` for
the meta line — with exactly two attribute-level overrides: the tag in a monospace family, so it is
distinguishable from prose by shape rather than by size, and tabular figures on the numeric meta, so
the day, asset count and download count line up down the page. Each fact's glyph is a 14dp Material
icon in the muted tone, so the line is scanned by shape before it is read. Do not grow this into a
per-surface size system; a third override needs the same kind of justification.

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
- Rows no longer show the asset count placeholders from the old subtitle, the draft or prerelease
  label, or the "Entry Release" text; the filter bar and the accent bar carry that information now.
  A reader who never uses filters loses the per-row draft marker by design.
- The download count is shown where it was already fetched, so no server or payload change is
  involved.
- Compact counts trade exactness for a short row: a reader who needs the precise number opens the
  release, and counts under a thousand keep their own digits.
- The meta line is one line by default. Adding another fact still pushes the download count out of a
  360dp row, so new meta content means deciding what leaves; a long tag ellipsises, and only a large
  text scale is allowed to wrap the facts.
