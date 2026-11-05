---
status: accepted
---

# The Followed Repositories panel states its work in the control that asked for it

The Followed Repositories panel is the sheet the Follows page opens to manage the account's Release
Follows, and the session behind it is the account's one confirmation authority (ADR 0021). Its header
row carries the count, the Compact/Detailed toggle, the reload action and Close; the space under it
belongs to repositories. Before this record a reload was stated twice, in two different places at two
different distances from the reader's finger. The reload action kept a static refresh glyph and said
nothing about the round it had started, while a second, separate indicator appeared as its own row
directly under the header for as long as the follow set was being read. The reader's eye was drawn to
a line they had not touched, and because that line entered and left the column, every reload pushed the
list down and pulled it back: motion the reader did not ask for, on a panel they opened to read their
repositories.

The Release Timeline had already settled the same question the other way. `TimelineToolbar` states a
round in the control that asked for it: while a round it started is in flight, that control's mark is
`GitPulseProgressInline` — the app's own row indicator, drawn rather than skinned (ADR 0032) — and the
control is disabled, so only one indicator is ever on screen. A round the pull gesture started is the
one exception, because the gesture draws its own progress at the top of the list, and there the control
keeps its glyph and stays disabled rather than adding a second statement.

## Decision

**The panel states its work in the control that asked for it.** While `ReleaseFollowsState.loading` —
the read of the confirmed follow set — is true, the action named `l10n.followsReload` keeps its place
in the header and keeps its name, its mark becomes `GitPulseProgressInline()`, and it refuses another
press. When the read finishes the mark returns to `Icons.refresh` and the control works again. The
separate indicator row under the header is deleted. A refresh therefore adds no row, moves nothing,
and the panel never draws an inline indicator beside the control's own: one indicator per panel, and
it is the one the reader pressed.

The control is not removed or replaced while it works, because it is the panel's only entry point for
re-reading the confirmed set; an indicator standing in its place would take the reader's way in away
for the duration of the read.

The first-load state — no confirmed list yet — is unchanged as a page state. `GitPulseLoadingView`
still fills the content area, and the header mark turns over it as well: the same statement at the same
control, not a second one. That is the one moment the panel also draws `GitPulseProgressPage`, because
a page that has no list yet has nothing else to say.

The panel reads the session's own `loading` field, the field that already gates the first-load page.
It does not keep a second flag of its own and does not infer work from a request, so the header and the
content area can never disagree about whether a read is in flight.

No pull-to-refresh is added. The panel has no scroll gesture that owns a refresh, so the control is the
whole statement and the gesture that does not exist cannot become a second one.

## The panel's other work belongs to the same rule

Two further states the panel owes are covered by the same principle, and they belong in this file as
the sections that record them rather than in a second record beside it:

- **Detailed View's details.** The description, language and star count arrive after the follow set,
  through the session's metadata read (ADR 0021). While they are still arriving, the
  Compact/Detailed toggle's mark is the panel's statement of that wait: it breathes in place and does
  not gain a second indicator, a row or a name. The control stays pressable and keeps its name, so the
  wait is the mark's motion and never a word. That section is not written by this record, and the
  motion is not implemented yet.
- **The rows.** The chrome states the panel's work so the content area can spend its height on
  repositories. The denser row — a tighter inset and a description held to one line — is the same
  decision seen from the content side: the panel does not spend its height on chrome, so it must not
  spend it on padding either. That section is not written by this record, and that density is not
  implemented yet.

## Consequences

- **Only one inline indicator is ever on screen, and it is the control's.** While the follow set is
  read, the header action's own mark turns and no `GitPulseProgressInline` appears anywhere else in the
  panel. The first-load page keeps `GitPulseProgressPage`, which is a page state rather than a row
  indicator and the one thing a content area with no list can say.
- **A refresh no longer moves the list.** The header row is the same height whether its control draws a
  glyph or the inline progress, both of which stand at the control's own measure, so the repositories
  do not leave and return as the read starts and finishes; the row the reader was reading stays where
  it was.
- **The control stays named and reachable.** Its accessibility name remains `l10n.followsReload`
  ("Reload follows"), and the inline indicator passes no label of its own because the control already
  names the work. The disabled state is announced on that same node, so a screen reader hears the
  action and that it is unavailable, rather than a new control called "loading".
- **A press during the read is refused rather than ignored.** The control's `onPressed` is null while
  `state.loading`, the same rule the Timeline's reload control applies, and `state.editBlocked` still
  disables it while an edit is being saved. Re-reading joined the read already in flight before this
  record, so nothing about the request changed; what changed is that the control now says so.
- **The rule is asserted where it is rendered.** `test/follows/release_follows_screen_test.dart` holds
  one settings read mid-flight (`FollowsServer.holdSettings`), mounts the whole client, opens the panel
  and asserts the widget tree: the control is disabled and its mark is the app's inline progress, no
  second inline indicator exists in the panel, the confirmed row has not moved, and after the hold
  completes the mark is `Icons.refresh` again with the control enabled and the list intact.
