---
status: accepted
---

# The backend is a Settings card, and a signed-out destination states no backend

The backend block appeared twice — as a Settings card and as the header of the sign-in page — and had
grown three faults. It reported health the reader did not ask about: a hairline pill reading "Connected"
(or "Offline") beside the backend's name, on every visit, to say that the ordinary case was ordinary.
Its address was one line under that pill and its way out a third: a full-width action in the card and a
lone text action on the page. And the same action — leaving this backend for another — was offered in
both places, while a state that _is_ news (a failed sign-in) was buried in the same stack.

## The card owns the backend

`lib/settings/backend_details.dart` is now one Settings card and nothing else. Its name shares a line
with the two actions that act on its address — copy it, and point the installation somewhere else — and
the address follows on a line of its own, across the card's width. Two lines, both starting at the
card's gutter, in the grammar the Language and Appearance cards use: a leading mark, the row's name, and
what the row holds under it. It is composed by hand rather than through `GitPulseSettingRow` because it
carries two trailing actions **and** a stack of state notes, which that row's `aside` and `notes` slots do
not describe.

Copying stays here because an address read on a phone is an address that is hard to retype, and a
reader shares it with whatever else on their network points at the same backend. Leaving a backend
names itself to a screen reader ("Change backend"), because leaving one clears this account's session
and cache.

## A backend that answers says nothing

The pill is gone, with the `backendConnected` string ("Connected"/"连接正常") behind it. What the block
states instead is the failure: a connection that could not report one, a rejected session, or — in the
muted tone, not the danger one — that the reader is reading saved history offline.

That last line is the one place this record amends the interface-copy rule ("a settings row … needs no
description line beneath it"). It is not a description of what the row is for: it is the state the
address is answering in, drawn in the same place and the same shape the row's failures use, and it is
shown only for a reader who has saved history to be reading. Reading an offline window is already stated
by the Timeline's own meta line; this is the second place it is legible, and it is the place a reader
who went looking for it would go.

## The signed-out destination is its ways in

`AccountGate` draws `SignInCards` and nothing else. The server those cards sign into is not restated
above them: the Settings destination always exists, session or not, and a reader who wants a different
server reaches that card the way they reached the page they are standing on.

The one thing drawn above the cards is `BackendStateNotes` — the session's own trouble, which is the
news a sign-in page exists to carry (a rejected password, a browser sign-in that expired, an identity
this device cannot account for, a failed sign-in of any kind). It draws nothing at all when it has
nothing to report, so on the ordinary visit the page's first ink is a way in.

## Consequences

- `BackendStateNotes` stacks the app's existing state lines in one place so no surface invents a second
  wording: the same `SessionNotice` the shell draws above a signed-in Timeline or Follows and the
  repository pages draw above their bands, plus the connection's own failure, a rejected session and the
  offline window. Its emptiness check is `SessionState.hasNotice` in `lib/session/session_controller.dart`,
  which is the same predicate `SessionNotice` draws by — a surface that stacks state lines must not pay
  for an empty one.
- `GitPulseStatusBadge` keeps its one job, a release's state; it is no longer the pill a backend's
  health is drawn in. This retires ADR 0020's cross-reference to "the same pill the Settings backend
  card draws" — the badge is unchanged, the instance it was introduced by is not.
- The sign-in page no longer carries a change-server entry, and
  `docs/flutter-release-timeline-spec.md`'s "change servers in Settings and before sign-in" now says
  what this record relies on: the Settings destination _is_ reachable while signed out, so changing a
  server before signing in still holds, through one entry rather than two.
- A reader loses the one-tap copy of the address on the sign-in page, and the address itself from that
  page. Both live on the card that owns them, and the address editor still holds the address in a field
  the platform lets a reader select and copy.

## A card's first line states its own top inset

A Settings card's first line is not always text alone. The Backend card's name shares its line with the
two actions that act on its address, and the Timeline cache card's name shares its line with Clear. A
control stands on the compact touch target, so that line is 40dp tall and the name inside it is
centred: its visible top sat about 10dp under the card's top edge while every card whose first line is
text alone started at the card's inset. The address line below kept the ordinary inset, so the card
read top-heavy with a hole under its own edge.

`GitPulseSettingSurface` now states the top inset of a card whose first line also holds its control.
The name sits on the card's inset whatever stands beside it, and the control keeps its whole target:
the card gives up the part of the target that stands above the name. The overhang is derived — half of
(the compact control target minus the name's line at the reader's text scale) — never a distance of
its own, and it clamps at zero, so a text scale large enough to fill the target keeps the ordinary
inset. `GitPulseSettingRow(inlineControl: true)` passes the statement on, and the hand-composed Backend
card declares it itself (`BackendDetails.firstLineHoldsControl`).

`GitPulseSettingLabelLine` is the other half of the rule: the name and its mark stand in a box as tall
as the compact target — or as tall as their own line, when large text is taller — so putting the
overhang back above the name costs the line nothing. The control is not boxed; it is the target the
line is stated from, and it is never shrunk to make the name fit. Large text is therefore not a
special case: the line grows past the target, the overhang falls to zero, and the name still begins on
the card's inset.

No other card's geometry changes, and the address keeps its distance from the name: the block below
the name moves up with it, and the card is that much shorter.
