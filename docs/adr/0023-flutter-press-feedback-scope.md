---
status: accepted
---

# A press leaves no background, and hover and focus keep the only tint

The Flutter client answers a press with **no background change at all**. `gitPulseTheme` sets the
Material ink response's highlight and splash colour to transparent, and the `IconButton`,
`TextButton` and `OutlinedButton` families resolve `pressed` to transparent through one shared
`WidgetStateProperty`. Hover and focus keep the half-strength surface-container tone that ADR 0019
introduced, because they carry a different job: on a desktop pointer they are the affordance that
says a surface is clickable, and on a keyboard they are the only evidence of where focus sits.
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
sanctioned non-fill remedy recorded in `design-system/gitpulse/MASTER.md` §10: a pressed surface
moves its hairline toward the primary tone. That remedy needs its own ADR, because it adds a
per-surface rule where this one deliberately adds none.

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
- The Release Timeline card's prerelease badge stays at `surfaceContainerHigh`, but no longer because
  of press-contrast. ADR 0019 moved it down a step so a pressed card would not dissolve it; with no
  pressed tone to collide with, the badge keeps that step for hierarchy alone.
- `lib/releases/repository_releases_view.dart` loses a `borderRadius: BorderRadius.circular(16)` on an
  ink response that already sat inside a `StadiumBorder`. It was a second declaration of a shape the
  widget had already decided, and with no splash left to clip it painted nothing.
- The rule is enforced by the design system, not by memory:
  `flutter/design-system/gitpulse/MASTER.md` §3.3 owns the state colours and §16 owns how to change
  them, and any pull request that adds a pressed tint or a per-surface overlay is out of spec.
