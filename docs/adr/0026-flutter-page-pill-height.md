---
status: superseded by ADR-0033
---

# The page pill is flatter than a toolbar control, and its cells are wider than they are tall

A page number is a footnote to the list it belongs to, not an action on it. With the page navigation
drawn as one hairline pill under a list of repositories, a cell at `GitPulseHeight.compact` (40dp)
made the pill read as a third row of the page: it was as tall as the search field above it and twice
as tall as the text it holds. `GitPulseHeight.pill` is therefore 32dp, and a step cell is
`GitPulseHeight.pill + GitPulseSpace.inline` (40dp) wide.

This amends one sentence of `gitpulse_tokens.dart` — "the floor for anything clickable" — for this
one control. It is not a licence for the rest of the app: 40dp stays the floor for a toolbar control,
a chip, a dropdown, a button and a list row. What the page pill buys in exchange is area rather than
height: a step cell is 40 x 32, comfortably inside the target Material asks for, and it sits in a
footer band the reader is already aiming at. The pill is also never the only way to move: the number
inside it is a field, so a keyboard reaches it without a pointer at all.

## Consequences

- A step cell keeps a 40dp horizontal target; only its height is below the toolbar floor. A future
  control that wants the same height needs its own argument here, not a copy of this one.
- The pill's number is `GitPulseWidth.pillNumber` wide at text scale 1 and the pill grows past
  `GitPulseHeight.pill` when the reader's type needs more room, so a large-text reader still gets a
  cell that fits the number rather than a clipped one.
