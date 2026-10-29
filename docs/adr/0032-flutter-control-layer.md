---
status: accepted
---

# The GitPulse client owns its control faces, and answers every press with the same contract

Material is the client's runtime, not its design language (ADR 0031). The Foundation Layer now
supplies every tone and every type row; this record decides the **Control Layer** — the surfaces a
reader operates — and the ink rule that governs all of them.

Five faces become GitPulse's own, each replacing its Material counterpart everywhere it appears:

| Face                      | GitPulse's own                                                                                                                                      | Replaced                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| The bottom navigation bar | `GitPulseNavigationBar` + `GitPulseNavigationDestination` (`lib/presentation/gitpulse_navigation_bar.dart`)                                         | `NavigationBar` / `NavigationDestination`                                          |
| The button family         | `GitPulseButton` with `GitPulseButtonVariant.filled / tonal / outlined / text`, and `GitPulseIconButton` (`lib/presentation/gitpulse_buttons.dart`) | `FilledButton`, `FilledButton.tonal`, `OutlinedButton`, `TextButton`, `IconButton` |
| The row indicator         | `GitPulseProgressInline` (`lib/presentation/gitpulse_progress.dart`)                                                                                | `CircularProgressIndicator(strokeWidth: 2)` in a row                               |
| The page indicator        | `GitPulseProgressPage` (`lib/presentation/gitpulse_progress.dart`)                                                                                  | `CircularProgressIndicator` in the loading/empty/error views                       |
| The dialog entry point    | `showGitPulseDialog` + `GitPulseDialog` (`lib/presentation/gitpulse_dialog.dart`)                                                                   | `showDialog` + `AlertDialog`                                                       |

The **switch** and the **checkbox** are the remaining faces of this decision. No screen this change
touched carries either, so they keep Material's own drawing until the screens that do are migrated;
until then `gitPulseInkOverlay` stays installed on `CheckboxThemeData`, exactly as ADR 0023 left it.

The **choice chip** (Settings' language and appearance choices) is not one of the five faces and is
not decided here. It stays Material's drawing, its selected state already comes from the app's own
`secondaryContainer`/`onSecondaryContainer` pairing in the theme, and the press rule reaches it
through the transparent highlight the theme sets. A chip that later needs GitPulse's own skin is a
sixth face of the same decision and needs its own amendment — it is named here so that its absence
from the replaced set is not read as an oversight.

## What each face keeps from the app it replaces

A replacement keeps the shape of the app's own surfaces rather than introducing a private geometry:
the row, surface, pill and gutter tokens, the glyph measures, the one hairline and the one type
table. Concretely:

- **The bar** is a surface standing on the page (`toneSurface`), told apart from it by one hairline
  (`toneBorder`) and never by a shadow. It is a row of destinations, each inset by
  `GitPulseSpace.rowInsetV` above and below, which makes it 67dp on a phone — taller than one
  control, because a destination is a mark above its word. The selected destination is the only one
  filled with the active step (`toneSurfaceActive`) and its mark and label are the Accent; the rest
  are `toneTextMuted`. That is the same pairing ADR 0031 states for a selected row and a chosen
  chip, so "where I am" needs no second colour and reads on both presentations. A screen reader
  hears what Material's bar told it — the label, that it is a button, and whether it is selected —
  from a `Semantics` node the bar now writes itself.
- **A button's label** is the type table's `labelMedium` row through `gitPulseTypeControlLabel`.
  Emphasis comes from the tone a variant reads on, never from a larger size: filled reads
  `toneOnAccent` on `toneAccent`, tonal reads the Accent on `toneAccentSoft`, outlined reads
  `toneText` inside a `toneBorder` hairline, text reads the Accent with no shape at all. A disabled
  control quiets to `toneTextSubtle` and keeps its place in the layout. The tap target is
  `GitPulseHeight.compact` at its floor; an icon action is a `GitPulseHeight.standard` square, which
  is the target Material's `IconButton` gave it, and the control owns its mark's tone and measure.
- **The two indicators** are drawn, not skinned: three quarters of a circle in the Accent, turning
  once every `gitPulseProgressTurn`, at a glyph's measure (20dp inline) or at the page state's
  measure (32dp, the size a message view leads with). A Material spinner the theme cannot reach is a
  spinner a Flutter upgrade can redraw — the M3 indicator has already changed shape once — so the
  face is the app's own and only the animation stays the framework's.
- **The dialog** is one function, the way `showGitPulseSheet` already owns every sheet: the route,
  the barrier, the scrim, the surface tone, the shape, the measure and the Escape key are decided in
  one place, and a body (`GitPulseDialog`) decides only its title, content and actions. The surface
  is `toneSurface` at `GitPulseRadius.surface`; the measure is `GitPulseWidth.dialog` (420dp), taken
  out of the page by the gutter, so a confirmation and a form arrive the same size; the scrim is the
  scheme's own `scrim` at `gitPulseDialogBarrierAlpha` (0.54, the strength Material's dialogs already
  had). A dialog keeps a scrim the sheets do not: a sheet is pulled away, a dialog is tapped away,
  and the page under a tap has to read as covered. Escape dismisses either.

## The interaction contract, restated

This record now owns the rule ADR 0019 introduced and ADR 0023 narrowed. In one sentence: **a press
paints no background, hover and keyboard focus paint the one half-strength tint, and a filled or
tonal surface keeps an answer to a press.**

- `gitPulseInkOverlay` resolves `pressed` to nothing, `hovered` and `focused` to
  `gitPulseHoverTint`, and every other state to null. Every control that has no fill of its own —
  outlined, text, icon, a destination in the bar — paints through it.
- `gitPulseFilledInkOverlay` is the same rule for a control that already paints the Accent: its own
  foreground laid on at `gitPulseFilledPressAlpha` (one tenth, the strength Material's filled
  overlay used) while pressed, and the one tint while hovered or focused. A coloured surface that
  did nothing at all under the finger reads as broken rather than as calm.
- **A control paints its own fill.** Ink is drawn below a `Material`'s child, so a control with a
  visible fill paints that fill through its own `Material` rather than through a container above the
  ink — the same failure ADR 0019 found in the Release Timeline card. The bar's selected
  destination and the filled button are built that way.
- **No surface sets its own overlay colour**, and nothing reintroduces a pressed tint. The
  sanctioned remedy if a press ever reads as dead is still the one ADR 0023 named: a pressed surface
  moves its hairline toward the Accent, and that needs its own record.

The theme keeps installing the same overlay on the Material families (`IconButton`, `TextButton`,
`OutlinedButton`, `Checkbox`) for the screens that have not been migrated yet, so the contract holds
across the two implementations rather than only in the new one.

## Platform Dialect Exceptions

These stay the platform's own — behaviour _and_ drawing — by decision rather than by omission. Each
is a control whose whole value is the behaviour a reader already knows, and restyling it would cost
that behaviour without buying anything GitPulse can name:

- **Text input and its editing behaviour** — the IME, selection, the magnifier, autofill, the
  selection toolbar. The app owns the decoration around a field (its fill, its outline, its type)
  and nothing about typing. A field the reader cannot select or paste in is a worse field, and no
  skin is worth that.
- **The date picker's calendar.** Choosing a date is the one interaction where the platform's own
  grammar (month paging, year selection, the accessibility of a grid of days) is the feature.
- **Tooltips.** A tooltip's timing, its long-press on touch and its hover on a pointer are the
  platform's; the app supplies the mark and the words, and `GitPulseIconButton` keeps the platform's
  `Tooltip` wrapping it.
- **Pull-to-refresh.** The gesture, its physics and its indicator belong to the scroll it is part
  of; the app decides only the tones that indicator is painted in.
- **The snackbar's behaviour.** It is skinned through the theme — its tone pair, its place on the
  screen, how long it stays — and not replaced, because a transient message's behaviour is the
  platform's and the app has nothing to add to it.
- **Tabs.** The tab bar's drag-to-switch, its paging and its swipe affordance are the platform's
  navigation grammar.
- **The Material icon glyphs.** The app writes its own names for them (`Icons.view_timeline_outlined`)
  and decides their tones and measures; the drawings themselves stay the platform's set, because a
  bundled icon font is its own decision.
- **The platform's page transitions and back affordance.** Push and pop, the predictive-back
  gesture and the system back button are the operating system's contract with the reader.

**The list may not grow silently.** Adding a Material control face that a reader operates requires
an amendment to this record naming the exception and its reason; a face that is missing from both
this list and the replaced set is an oversight, not a decision.

## The release gate

No screen may present the old controls and the new ones side by side at release. The transition is
allowed inside a development branch only: a Flutter distribution that shipped half the client on
Material's button family and half on GitPulse's would be visible as a mixture, and a reader would
learn the app twice. The pilot is Settings, because it is the only surface that carries the shell's
bar together with three of the replaced faces while every remaining exception lives elsewhere.

Enforcement is executable rather than documentary: a migrated screen's widget test asserts that the
replaced Material faces are absent from its rendered tree (`find.byType(FilledButton)` and its
siblings → `findsNothing` inside that screen). The project's rule against testing source text is
respected because the assertion is about what rendered.

## Consequences

- **ADR 0019 and ADR 0023 are superseded by this record.** Their bodies stay: the tone the tint is
  made of, the ink-below-content failure, the Release Asset row, the notes/assets boundary, the
  humanised download sizes, and the reasons a press paints nothing are all still true and are
  inherited here.
- The interaction contract is now asserted in two places, and both must keep passing: the
  theme-level test reads the ink the framework is handed by the app's own controls (and by the
  Material families still in use), and each face's own test reads what a reader gets — a press, a
  hover, a disabled control that refuses, a tooltip, a dialog that dismisses.
- A Flutter upgrade can no longer restyle the faces a reader operates. What is left to Material is
  the list above, and each entry on it is a behaviour the platform does better than the app would.
- The switch and the checkbox are still Material's today. That is a gap in this record's coverage,
  not a reversal of it: the two screens that show them are the next migration, and until then the
  theme's overlay keeps their press rule identical to the app's.
- Two small visible changes follow from the geometry the faces keep rather than choose: an icon
  action in Settings is now one 40dp-square target instead of Material's padded 48dp variant, and
  the Settings row that clears the timeline cache reports success with the **success** tone on its
  check mark rather than with the Accent — a confirmation is a receipt, and the Accent means the app
  is acting (ADR 0031).
- The theme's own Material component themes (`iconButtonTheme`, `textButtonTheme`,
  `outlinedButtonTheme`, `checkboxTheme`) stay installed while unmigrated screens use them. They
  become deletable when the last screen moves, and deleting them is the proof this decision is
  finished rather than merely recorded.
