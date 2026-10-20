---
status: accepted
---

# The Flutter Release Drawer reads first instead of opening wider

The Flutter Release Drawer keeps its 70% opening height, its 40% minimum, its full-screen maximum, its
0.7 snap size and every gesture threshold — ADR 0010 continues to govern the sheet. What changes is
what occupies that space: a drag handle plus one 48px chrome line replaces the handle, a "Release
details" heading and a body whose first screen went to a repository button, a list button, a tag chip,
an author chip and a date row. The sheet also stops reserving the status bar inset at its own top edge,
which is in the middle of the screen. The chrome line carries the tag and the repository full name and
targets the repository page; the close action, the Repository Release List, the way out to GitHub and the
one step back to the Entry Release share its icon slots, so no action has to be reached by scrolling past
the notes — the GitHub slot points at the open release, or at that repository's release list while the
list holds the body. Author, publish time and draft or prerelease state collapse into one muted meta
line, which groups tightly with the release name — always shown, even when it repeats the tag — and a
rule then separates that header from the notes, so a changelog's own first heading cannot read as a
continuation of the release name. Assets fold into one expandable row, and the notes document gets its
own type scale.

On a wide layout the panel is exactly one Release Timeline column wide — the right-most column plus the
trail padding — instead of a fixed 680dp. The width is derived from the timeline's own column count,
horizontal padding and column gap, which are now named constants shared by both, so the two cannot
drift apart. On a 1536dp window the panel is 509dp: the columns beside it stay readable instead of
losing half their width to a panel that did not need it.

A future reader should not "fix" the panel back to a fixed pixel width, and should not replace the notes
type scale with the HTML renderer's browser default ladder — that ladder is what pushed a first-level
heading 65px down and put fifth-level headings below body size. ADR 0015 makes the Flutter client its own
product boundary rather than a reproduction of the web client, so its native presentation is not bound to
the web overlays' 70vh rule that ADR 0010 keeps for the web Release Drawer and Release Timeline Filter
Panel. This divergence changes no part of the concept ADR 0012 fixes (Entry Release, Repository Release
List, one-step return).

## Consequences

- Panel width follows the timeline's column metrics, so it is narrower than the previous fixed width
  everywhere above the phone breakpoint, and it steps down when the timeline adds a column: a 1100dp
  window gets a 544dp panel while 1101dp gets 364dp. That step is the timeline's own breakpoint, not a
  defect.
- The timeline's horizontal padding and column gap are shared constants: changing either now moves the
  Release Drawer's panel too.
- The notes type scale lives in the renderer's custom styles hook. Reimplementing block rendering, or
  changing a heading tier, changes what every release body reads like.
- Opening height, snap sizes and drag thresholds remain ADR 0010's. Reading space was bought from the
  chrome, not from the sheet.
