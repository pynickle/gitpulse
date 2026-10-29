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

## Earlier downward dismissal — superseded by the section below

The Flutter Release Drawer's minimum height is now 50% of the window, superseding the 40% minimum
above. A downward drag closes the drawer when its top reaches the middle of the screen, reducing
travel from the 70% opening height by one third. The opening height, full-screen maximum and 0.7 snap
remain unchanged. Header drags and repository-list drags use the same minimum, and dismissal still
prevents a subsequent snap animation. This tuning is specific to the Flutter Release Drawer.

## A short pull settles the drawer

Half the screen was still a long way to pull to put a sheet away, so the drawer now settles 96dp either
side of the height it opens at: a pull down of 96dp closes it — on a 1000dp window that is 60.4% of the
height, against the 50% the section above recorded and the 40% before it — and a pull up of 96dp opens
it fully. Coming back down from full screen takes the same 96dp to return to the opening height. 96dp
is a distance, not a share of the window, so the same finger travel works on a short phone and on a tall
one, and a flick settles the sheet the way it was thrown at about 700dp a second. Nothing settles in a
direction it was not going: a downward flick from full screen returns the drawer to the height it opens
at rather than closing the notes a reader had enlarged.

Those lines are the sheet's own bounds, so a gesture and the report that closes the drawer agree on where
they land: the closing line is the sheet's minimum size and the opening height is its snap size. A pull
that stops short of its line rebounds to the height the drag started from, so a touch that drifts while
reading moves nothing. A list scrolled past its own top shrinks the sheet through
`DraggableScrollableSheet`'s snapping, which settles on the nearest of the closing line and the opening
height — the halfway point between them is about 70dp of finger, so that route is if anything quicker
than the header's.

A future reader should not reintroduce a share of the window as these thresholds, and should not make a
downward flick close a full-screen read: both are how the drawer came to need a drag the reader noticed.
