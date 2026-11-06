# Narrow notification rows trade the todo control for a right swipe

On a phone the notification row's add-to-todo button was a 26px target sitting beside a
mark-as-read button, both stacked in a 30px column at the row's right edge. The narrow
list now removes the todo control and lets the card itself carry the action: pressing a
row and dragging right uncovers a coloured surface behind the card, and releasing past a
quarter of the row width runs the same toggle the button ran.

The gesture is a share of the row's own width, never a pixel count, so a 320px phone and
an 860px narrow window move the card by the same proportion. The axis is claimed only
when a press travels 8px and horizontally outweighs its vertical travel; the card then
follows the finger no further than 35% and arms at 25%. `touch-action: pan-y` keeps
vertical scrolling native — the row owns the horizontal axis only.

Three consequences are deliberate:

- **The control is only removed where the gesture replaces it.** The todo tab keeps its
  remove button, because the swipe runs there on nobody's behalf. And a narrow _desktop_
  window keeps the button too: the gesture is not conditioned on a pointer capability but
  the removal is, so a mouse-driven narrow viewport is never left without a visible
  control.
- **The action colour is the row's whole background, and the card keeps an opaque
  floor.** The surface spans the full row so the reveal reads as the card sitting on
  colour rather than a coloured strip beside it. Because an unread card's wash is
  translucent, the card gets an opaque `surface` backing of its own box (it moves with
  the card), or the colour would show through the card body instead of only around it —
  the unread look has to stay exactly as it was.
- **A saved row marks itself on its border only** (`--gitpulse-accent`, plus a 1px inset
  ring). The body, including the unread wash and the 4px unread bar, is untouched: "in a
  todo" and "unread" are independent states and must not overwrite each other.

The first-visit demonstration is a saved per-user setting rather than an in-memory flag,
so it happens at most once in a reader's life. It belongs to the narrow touch list — the
one where the control is actually gone — and is consumed when that list first settles,
even when it is empty; only the rest of the same page load may still demonstrate a row
that arrives later. It waits for the target row's own details before sliding it, so it
never demonstrates on a card that is still growing. An interaction that cancels the
demonstration still spends the visit, or a reader who scrolled once would be taught on
every later visit. Under `prefers-reduced-motion` the card never moves and the short hint
takes the demonstration's place; otherwise that hint accompanies the moving card, which
is the one place the copy earns its keep. The guide wording is stacked under its icon
because the card uncovers at most 35% of the row, and a side-by-side icon would leave the
arming copy too little width to read.

Rejected: hiding the control whenever the viewport is narrow regardless of pointer (it
strands touch-capable desktop windows without a visible control), and a toast for the
result (the repo has no toast layer, and the revealed surface is already on screen).
