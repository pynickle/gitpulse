---
status: accepted
---

# A press leaves no background, and hover and focus keep the only tint

The Flutter client answers a press with **no background change at all**. `gitPulseTheme` sets the
Material ink response's highlight and splash colour to transparent, and the `IconButton`,
`TextButton`, `OutlinedButton` and `Checkbox` families resolve `pressed` to transparent through one
shared `WidgetStateProperty`. Hover and focus keep the half-strength surface-container tone that
ADR 0019 introduced, because they carry a different job: on a desktop pointer they are the
affordance that says a surface is clickable, and on a keyboard they are the only evidence of where
focus sits.
`FilledButton`, `FilledButton.tonal` and `ElevatedButton` keep Material 3's own overlay — their
surfaces are already coloured, so the tint reads as depth rather than as grime, and a primary action
is the one place a press genuinely needs an answer.

This supersedes the pressed and splash half of ADR 0019. What it keeps from that ADR: no surface sets
its own overlay colour, the Release Timeline card still paints its own surface through `Ink` (hover
still needs an ink layer), the Release Asset rows still open a download from the whole row, and the
notes and the asset module are still separated by a boundary rather than a nested card. What it ends:
`gitPulsePressTint` is deleted, and the theme no longer exists to tint a press. `gitPulseHoverTint`
survives and now feeds `hoverColor` and `focusColor` alike.

The reader should not reintroduce a pressed tint, and should not read "no press feedback" as a bug to
be fixed by adding one back. The replacement, if a review ever judges the result dead, is the
sanctioned non-fill remedy: a pressed surface moves its hairline toward the primary tone. That remedy
needs its own ADR, because it adds a per-surface rule where this one deliberately adds none.

## Consequences

- The perceived dark wash is gone everywhere. It came from Material 3's own component defaults — a
  10% `onSurfaceVariant` overlay on `IconButton` and the button families — not from `gitPulseTheme`,
  which had been setting a lighter tone. One sampled fact made the rule simple rather than partial:
  `RawChip` builds a plain `InkWell` and `ListTileThemeData` has no `overlayColor` field, so both
  follow `ThemeData.highlightColor` and the transparent tone reaches chips and list rows too. No
  surface is left showing a pressed tint.
- A press on a Release Timeline card, a Follows row or a chip now paints nothing. ADR 0019's reason
  for the old tint — "a surface that answers a press with nothing reads as unresponsive" — no longer
  describes the decided behaviour; it was weighed against the owner's judgement that the dark wash
  cost more than the feedback was worth.
- Touch platforms lose the last cue a press has before the destination arrives. On Android and iOS
  there is no hover to fall back on, so the resulting page change or drawer is the only confirmation.
  This is accepted, with the border-emphasis remedy above as the documented escape hatch.
- Keyboard focus stays visible. Killing `focusColor` along with the press tint would have removed the
  only focus indicator on custom ink surfaces, which is an accessibility failure rather than a
  stylistic choice; the shared resolver therefore keeps `focused` and `hovered` on the old tone.
- The rule reaches further than the theme's own settings. `IconButtonThemeData` returns one style
  for all four `IconButton` variants, so the shared overlay lands on `IconButton.filled`,
  `.filledTonal` and `.outlined` too; the filled-varying ones sit on a coloured surface, which is
  E9's case, so a filled or tonal icon button takes Material's wash of its own tone back at its
  call site with `IconButton.styleFrom(overlayColor: …)`. `Switch` keeps Material's radial
  reaction, which is a halo around the thumb rather than a surface tint, and `SegmentedButton`
  segments keep theirs because the widget wraps them in their own `TextButtonTheme`. Both are
  recorded as deliberate exceptions rather than left to be rediscovered.
- The Release Timeline card's prerelease badge stays at `surfaceContainerHigh`, but no longer because
  of press-contrast. ADR 0019 moved it down a step so a pressed card would not dissolve it; with no
  pressed tone to collide with, the badge keeps that step for hierarchy alone.
- `Checkbox` paints its press reaction itself rather than inking through an `InkWell`, so it takes
  the shared resolver through `CheckboxThemeData.overlayColor` instead of the theme's splash. Its
  box and check stay Material 3's own scheme colours — the checked fill is the scheme's primary —
  because the tint answering a press says nothing about how a selected control is drawn.
- `lib/releases/repository_releases_view.dart` loses a `borderRadius: BorderRadius.circular(16)` on an
  ink response that already sat inside a `StadiumBorder`. It was a second declaration of a shape the
  widget had already decided, and with no splash left to clip it painted nothing.
- The rule is enforced by the theme's shared resolver and by this record, not by memory:
  `gitPulseInkOverlay` resolves the hover and focus tone for every surface, and any pull request
  that adds a pressed tint or a per-surface overlay is out of spec.
