---
status: accepted
---

# The GitPulse client owns its control faces, and answers every press with the same contract

Material is the client's runtime, not its design language (ADR 0031). The Foundation Layer now
supplies every tone and every type row; this record decides the **Control Layer** — the surfaces a
reader operates — and the ink rule that governs all of them.

Seven faces become GitPulse's own, each replacing its Material counterpart everywhere it appears:

| Face                      | GitPulse's own                                                                                                                                      | Replaced                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| The bottom navigation bar | `GitPulseNavigationBar` + `GitPulseNavigationDestination` (`lib/presentation/gitpulse_navigation_bar.dart`)                                         | `NavigationBar` / `NavigationDestination`                                          |
| The button family         | `GitPulseButton` with `GitPulseButtonVariant.filled / tonal / outlined / text`, and `GitPulseIconButton` (`lib/presentation/gitpulse_buttons.dart`) | `FilledButton`, `FilledButton.tonal`, `OutlinedButton`, `TextButton`, `IconButton` |
| The switch                | `GitPulseSwitch` (`lib/presentation/gitpulse_toggles.dart`)                                                                                         | `Switch` / `SwitchListTile`                                                        |
| The checkbox              | `GitPulseCheckbox` (`lib/presentation/gitpulse_toggles.dart`)                                                                                       | `Checkbox` / `CheckboxListTile`                                                    |
| The row indicator         | `GitPulseProgressInline` (`lib/presentation/gitpulse_progress.dart`)                                                                                | `CircularProgressIndicator(strokeWidth: 2)` in a row                               |
| The page indicator        | `GitPulseProgressPage` (`lib/presentation/gitpulse_progress.dart`)                                                                                  | `CircularProgressIndicator` in the loading/empty/error views                       |
| The dialog entry point    | `showGitPulseDialog` + `GitPulseDialog` (`lib/presentation/gitpulse_dialog.dart`)                                                                   | `showDialog` + `AlertDialog`                                                       |

The switch and the checkbox were the last two faces named by this record as still Material's. They
arrive with the surface that carries them — the Release Timeline's Filter Panel, the client's only
toggle surface — and they carry what Material's carried: the track and the box drawn in the preset's
tones, the thumb crossing the track and the check drawing itself in, the mixed state a tristate box
states, the disabled state, the tap-target floors, and the role, state and name a screen reader is
given. With them, no Material checkbox or switch is drawn anywhere in the client, so the theme no
longer installs `CheckboxThemeData`: an ink override for a control the client does not draw would be
an override with nothing to override.

The **choice chip** (Settings' language and appearance choices) is not one of the seven faces. It
stays Material's drawing, its selected state already comes from the app's own
`secondaryContainer`/`onSecondaryContainer` pairing in the theme, and the press rule reaches it
through the transparent highlight the theme sets. It is registered below as a Platform Dialect
Exception rather than left out of both lists: a chip that later needs GitPulse's own skin is an
eighth face of this decision and needs its own amendment.

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
  That face has three standings and knows all of them: on the page (the platform's square, a quiet
  mark), inside a control (`dimension: GitPulseHeight.compact` for a field's clear mark, so the mark
  never grows the field it sits in), and floating over content (`floating: true`, a shell-toned disc
  inside one hairline — the app raises a surface with a boundary, never with a shadow).
- **A control owns its mark's tone, and one status may overrule it.** The rule is the control's,
  not the caller's: an `icon` handed to a button takes the variant's ink, so a button reads as one
  control in whichever standing it is drawn. A caller may name a tone in exactly one situation, and
  `GitPulseButton.statusMarkTone` exists for no other: when the mark **is** the status the action
  reports rather than a picture of what it does, and no line of text carries that status — a Follow
  set the app could not read or save, reported by the manage action's mark; a clear that landed,
  reported by the check that stands in its bin's place. That argument takes a status tone
  (`toneDanger`, `toneSuccess`) and never the Accent, which means the app is acting; a disabled
  action quiets its mark with the rest of itself. Every ordinary action — a retry, a filter, a
  share, a follow, a close — passes nothing. An icon action has the same rule in its own shape: its
  mark is quiet on the page and floats in `toneText` on its own surface, and the two states it can
  _be_ are `emphasized` (this is already applied) and `selected` (this is a mode the reader turned
  on, which the control announces to a screen reader as selected rather than leaving a surface to
  paint one half of the statement and forget the other).
- **The switch** is a `gitPulseSwitchTrack` (52 × 32) pill inside a `GitPulseHeight.standard` target.
  Off is the palette's active step (`toneSurfaceActive`) framed by one `toneBorderStrong` hairline,
  under a `toneTextSubtle` thumb; on is the Accent with the thumb in `toneOnAccent`. The thumb crosses
  the track over `gitPulseToggleTurn` and the two tones cross with it, and a disabled switch holds its
  shape in `toneSurfaceMuted` and `toneTextSubtle`. It stands where Material's switch stood, so the
  panel's row keeps its height.
- **The checkbox** is a `GitPulseIconSize.inControl` (18dp) box at `GitPulseRadius.bar`: a
  `toneBorderStrong` hairline with no fill while it is clear, the Accent with a `toneOnAccent` mark
  while it is chosen, and the dash of the same mark when a tristate value is mixed. The mark is a
  drawn path that fills in over `gitPulseToggleTurn`, not a Material glyph. `dimension` is the square it
  answers a finger in; a box drawn at the end of a row takes the row's own remaining square (the
  Timeline's Filter Panel passes `GitPulseHeight.rowMin` less its two insets), because there the row —
  not the box — is the target, and the row keeps the rhythm it already had.
- **The two indicators** are drawn, not skinned: three quarters of a circle in the Accent, turning
  once every `gitPulseProgressTurn`, at a glyph's measure (20dp inline) or at the page state's
  measure (32dp, the size a message view leads with). A Material spinner the theme cannot reach is a
  spinner a Flutter upgrade can redraw — the M3 indicator has already changed shape once — so the
  face is the app's own and only the animation stays the framework's.
- **The dialog** is one function, the way `showGitPulseSheet` already owns every sheet: the route,
  the barrier, the scrim, the surface tone, the shape, the measure and the Escape key are decided in
  one place, and a body (`GitPulseDialog`) decides only its title, content and actions. The surface
  is `toneSurface` at `GitPulseRadius.surface`; the measure is `GitPulseWidth.dialog` (420dp), taken
  out of the page by the gutter, so a confirmation and a form arrive the same size; the barrier is
  `toneScrim` — the scheme's own darkest ink, `scrim` — at `gitPulseDialogBarrierAlpha` (0.54, the
  strength Material's dialogs already had). A dialog keeps a barrier the sheets do not: a sheet is
  pulled away, a dialog is tapped away, and the page under a tap has to read as covered. Escape
  dismisses either. The barrier is the one Material colour role the client still reads, and it reads
  it in the tone module (`toneScrim`) rather than in the dialog, because a barrier's value is "the
  darkest ink this presentation has" rather than a step the shared palette names — it is black on
  both presentations and would be a wrong tone if it were the palette's strong text, which is near
  white in the dark one. A future preset that carries an `overlay` tone takes the role over.

## The interaction contract, restated

This record now owns the rule ADR 0019 introduced and ADR 0023 narrowed. In one sentence: **a press
paints no background, hover and keyboard focus paint the one half-strength tint, and a filled or
tonal surface keeps an answer to a press.**

- `gitPulseInkOverlay` resolves `pressed` to nothing, `hovered` and `focused` to
  `gitPulseHoverTint`, and every other state to null. Every control that has no fill of its own —
  outlined, text, icon, a destination in the bar, both toggles — paints through it.
- **The one tint is the active step at `gitPulseHoverTintAlpha` (one half), and it is not the shared
  `surface-hover` tone.** These two answer different questions, and the record settles which one
  this client paints: `surface-hover` is a _static background_ the web app puts under a row the
  pointer is on, while this tint is an _overlay_ the client lays over whatever fill a surface
  already has — a white card, a tinted chip, the bar's own surface. Painting the shared background
  under an ink layer would either hide the surface's own fill or double the tone on a surface that
  already carries it. So the client's wash is `surface-active` at a named alpha, `surface-hover` is
  a background this client does not paint, and both stay rows of the shared data because both
  clients may present them. The strength is stated once in `gitpulse_theme.dart` rather than inside
  the expression, because it is a decision and not arithmetic; changing the tint's appearance is a
  change to that constant and to this paragraph, never a quiet edit to a formula.
- `gitPulseFilledInkOverlay` is the same rule for a control that already paints the Accent: its own
  foreground laid on at `gitPulseFilledPressAlpha` (one tenth, the strength Material's filled
  overlay used) while pressed, and the one tint while hovered or focused. A coloured surface that
  did nothing at all under the finger reads as broken rather than as calm.
- **A control paints its own fill.** Ink is drawn below a `Material`'s child, so a control with a
  visible fill paints that fill through its own `Material` rather than through a container above the
  ink — the same failure ADR 0019 found in the Release Timeline card. The bar's selected
  destination and the filled button are built that way; the toggles paint their track, box and thumb
  through `Ink` on the ink layer for the same reason, so the app's one tint reads over a switch's
  track exactly as it reads over a card.
- **No surface sets its own overlay colour**, and nothing reintroduces a pressed tint. The
  sanctioned remedy if a press ever reads as dead is still the one ADR 0023 named: a pressed surface
  moves its hairline toward the Accent, and that needs its own record.

The theme installs that overlay on the two Material families a retained control still draws —
`IconButton`, which the bar's back affordance and the date picker's calendar/input toggle are, and
`TextButton`, which the date picker's own actions are — so the contract holds in the one place a
reader still meets Material's drawing rather than only in the app's own controls. A retained face a
screen mounts itself is handed the same overlay at its call site; see the exceptions below. The
toggle families are not among them: `checkboxTheme` is gone, `switchTheme` was never installed, and
the app's own toggles read `gitPulseInkOverlay` directly.

## Platform Dialect Exceptions

These stay the platform's own — behaviour _and_ drawing — by decision rather than by omission. Each
is a control whose whole value is the behaviour a reader already knows, and restyling it would cost
that behaviour without buying anything GitPulse can name:

- **Text input and its editing behaviour** — the IME, selection, the magnifier, autofill, the
  selection toolbar. The app owns the decoration around a field (its fill, its outline, its type)
  and nothing about typing. A field the reader cannot select or paste in is a worse field, and no
  skin is worth that.
- **The date picker's calendar.** Choosing a date is the one interaction where the platform's own
  grammar (month paging, year selection, the accessibility of a grid of days) is the feature. The
  theme gives it the app's surface tone and the app's ink on its own buttons, and nothing else.
- **The bar a page is titled with (`AppBar`)**: the Connection page's bar and
  `RepositoryPageAppBar`. A bar is where the platform's contract with the reader actually arrives —
  the back affordance, the system back gesture, the page below animating under a toolbar of the
  framework's own height — and the app's only reader-operated controls in it are its own: an icon
  action, and a back affordance that is the platform's. So the bar keeps the platform's behaviour
  and is _skinned_ through the theme instead of replaced: the app's surface tone, no Material 3
  elevation and no scroll-under tint, the one hairline the app separates chrome with, and the type
  table's role for its title. Its drawing is not stock Material even though its behaviour is the
  platform's; converting it into an eighth face would mean owning the back affordance and the
  page transition, which is the opposite of what this record decides.
- **The segmented control (`SegmentedButton`)**: the Follows sort control. A segmented choice is the
  platform's grammar for "one of these, and one is chosen" — its keyboard and pointer handling, its
  selection group semantics and its own single-shape drawing — and the app has no second control
  that wants that shape. It is the one retained face a screen mounts itself, so it is handed the
  app's ink at its call site: the `TextButtonTheme` it wraps its segments in would otherwise shadow
  the theme's entry, and a segment would paint Material's pressed wash. It draws its segments as
  Material `TextButton`s, which is why the app-wide assertion lets an occurrence under it through.
- **The choice chip (`ChoiceChip`)**: Settings' language and appearance choices. A chip's press, its
  own measure and the check mark it shows while chosen are the platform's control grammar, and the
  app supplies what it has an opinion about — the tone pairing for the chosen state, and the one ink
  through the theme's transparent highlight and hover tint.
- **Tooltips.** A tooltip's timing, its long-press on touch and its hover on a pointer are the
  platform's; the app supplies the mark and the words, and `GitPulseIconButton` keeps the platform's
  `Tooltip` wrapping it.
- **Pull-to-refresh.** The gesture, its physics and its indicator belong to the scroll it is part
  of; the app decides only the tones that indicator is painted in. Its indicator is a
  `CircularProgressIndicator` subclass, which is why the app-wide assertion reads progress by
  subtype only on a settled tree.
- **The snackbar's behaviour.** It is skinned through the theme — the scheme's inverse tone pair,
  which is what a snackbar reads — and not replaced, because a transient message's behaviour is the
  platform's and the app has nothing to add to it. There is no `snackBarTheme`: the tone pair is
  already the app's.
- **Tabs.** The tab bar's drag-to-switch, its paging and its swipe affordance are the platform's
  navigation grammar. The app hands the Follows tab bar its own indicator, hairline and ink.
- **The Material icon glyphs.** The app writes its own names for them (`Icons.view_timeline_outlined`)
  and decides their tones and measures; the drawings themselves stay the platform's set, because a
  bundled icon font is its own decision.
- **The platform's page transitions and back affordance.** Push and pop, the predictive-back
  gesture and the system back button are the operating system's contract with the reader. In the
  repository pages' bar the affordance is literally Material's `BackButton`, which is an
  `IconButton` — the family the theme still inks for that reason.

**The list may not grow silently.** Adding a Material control face that a reader operates requires
an amendment to this record naming the exception and its reason; a face that is missing from both
this list and the replaced set is an oversight, not a decision.

## What the theme still installs, and why

`gitpulse_theme.dart` is no longer a document of undone Material. Every entry it installs is one the
app believes in, and each has a consumer named here:

| Entry                                                    | What it serves                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colorScheme`, `textTheme`, `extensions`                 | The Foundation Layer itself (ADR 0031): the preset's tones and type table, presented to every widget, and read back by the `tone…` and `gitPulseType…` helpers.                                                                                                                                                                                                  |
| `scaffoldBackgroundColor`                                | The page: the shell tone every screen stands on, the web app's slate.                                                                                                                                                                                                                                                                                            |
| `appBarTheme`                                            | The two bars (see the exceptions): surface tone, no elevation, no M3 scroll tint, one hairline, the table's title role.                                                                                                                                                                                                                                          |
| `datePickerTheme`                                        | The date picker: the surface tone the app's own sheets are drawn on.                                                                                                                                                                                                                                                                                             |
| `highlightColor`/`splashColor`/`focusColor`/`hoverColor` | The plain ink — nothing on press, the one tint on hover and focus — for every `InkWell` the app draws without an overlay of its own: the Release Drawer's rows, the asset rows, the Follows rows, a chip that is not chosen, the filter panel's date bounds. A plain `InkWell` has no overlay of its own to state the rule in, so the rule is the theme default. |
| `iconButtonTheme`                                        | `IconButton`: the bar's back affordance (`BackButton extends IconButton`) and the date picker's calendar/input toggle.                                                                                                                                                                                                                                           |
| `textButtonTheme`                                        | `TextButton`: the date picker's own action buttons.                                                                                                                                                                                                                                                                                                              |

Three entries the theme used to carry are gone with the last surface that drew their family:
`outlinedButtonTheme` (the client mounts no `OutlinedButton`, and no retained control builds one),
`dialogTheme` (no Material dialog is opened — the date picker reads `datePickerTheme` instead) and
`checkboxTheme` (retired with the toggles). `switchTheme` was never installed. What is absent is
absent by decision: re-adding one of them without a screen that draws the family is the "override
with nothing to override" this record exists to end.

## The vocabulary, and the literals

App code names a GitPulse tone or a GitPulse type role, never a Material one: outside the tone and
type modules no file reads `colorScheme.<role>` or `Theme.of(context).textTheme.<role>`. A file that
needs a scheme at all hands the whole object to `toneEdge`, `toneRule`, `toneScrim` or
`gitPulseInkOverlay` — a reader in the module that owns the translation — and never takes a role off
it. The tone and type modules (`gitpulse_tokens.dart`, `gitpulse_preset.dart`, the generated palette
and `gitpulse_theme.dart`) are the one place the client speaks Material's colour and type
vocabulary, which is what makes a Flutter upgrade unable to redefine what the app's design says.

No screen or widget states a colour either. `Color(0x…)` and `Colors.<name>` live in the preset, the
generated palette and the theme's own scheme mapping; a surface that shows the ink beneath it rather
than a fill of its own says `GitPulsePaint.none`, and a size that a widget needs is a token or a row
of the type table. Nothing states a `fontSize` at a call site: the eight chrome roles and the
reading scale are the table's, and a ninth size is a row.

**Two tones are data for both clients, not strengths this client mixes.** `page-bg` is the canvas a
page stands on — the tone the web app paints its own body with — and `shell-bg` is a step _within_ a
surface: the well a field, an avatar disc or a floating action is cut into. `scaffoldBackgroundColor`
is the page tone, so a Repository page and the web page about the same repository stand on the same
slate, and a card, a bar or a sheet is told apart from it by the palette's step and its own hairline.
`danger-soft` is the wash a failure is reported on, and both the failure banner and the scheme's
`errorContainer` read it: the web app paints the same value behind its own failure banners, and a
client that derived its own proportion would sit on a different hue in the light presentation and at
a different strength in the dark one. Every other wash the client paints is a named constant with a
stated job — `gitPulseHoverTintAlpha`, `gitPulseFilledPressAlpha`, `gitPulseDialogBarrierAlpha` — and
no surface alpha-blends a tone on its own.

**A tone nobody paints is still data.** Four tones in the shared palette have no reader in the
client, because the client draws no surface of that job: `surface-raised` (a step the client's cards
do not take), `surface-hover` (a static row background, above), `success-solid` and `danger-solid`
(the fills a status chip or a solid badge paints — the client's receipts are a mark and a line).
They stay rows of the shared data rather than being deleted, because the web app presents the same
vocabulary and a second client may present them; what is deleted is a **reader** with no reader. The
theme test states the set: it fails if a tone has no reader that should have one, and it fails if one
of these four grows a reader without a surface that paints it.

**One recorded literal exemption.** `gitpulse_language_colors.dart` maps a repository's language to
a colour with raw literals, duplicating the web app's language colours. It is pre-existing and is not
migrated here: the two lists are presentation data in neither client's palette, they disagree today,
and reconciling them is a data decision of its own rather than a value this record may declare. It is
the one file outside the tone modules that names a colour, and it stays named as the exemption until
a change reconciles the two lists into the shared data.

## The release gate

No screen may present the old controls and the new ones side by side at release. The transition is
allowed inside a development branch only: a Flutter distribution that shipped half the client on
Material's button family and half on GitPulse's would be visible as a mixture, and a reader would
learn the app twice. The pilot was Settings, because it was the surface that carried the shell's bar
together with three of the replaced faces while every remaining exception lives elsewhere.

Enforcement is executable rather than documentary. Each migrated screen's widget test asserts that
the replaced Material faces are absent from its rendered tree (`find.byType(FilledButton)` and its
siblings → `findsNothing` inside that screen), and `test/presentation/app_faces_test.dart` is the
client's own settlement: it mounts the real app and visits the three destinations, the Connection
page, the Repository page and the release surfaces — the Release Drawer a Timeline card opens, with
its notes and its asset rows — asserting that none of the replaced faces renders, that the exceptions
still render as themselves, and that the day the theme's remaining entries reached the picker's
buttons is the day they stopped being dead weight. The list and the exception carve-outs live in one
place, `test/support/material_faces.dart`, so a screen test, the Timeline's own screen test, the
Settings page, the reading surface and the app-wide test assert **one** rule instead of a copy of it
per file: a stray face added to any of them fails, and an exception added to the list is a decision
recorded here rather than a copy edited in one file. The project's rule against testing source text
is respected because every assertion is about what rendered.

## Consequences

- **ADR 0019 and ADR 0023 are superseded by this record.** Their bodies stay: the tone the tint is
  made of, the ink-below-content failure, the Release Asset row, the notes/assets boundary, the
  humanised download sizes, and the reasons a press paints nothing are all still true and are
  inherited here.
- **The page is the shared canvas tone, not the shell's.** `scaffoldBackgroundColor` reads the
  palette's `page-bg`, so the client and the web app put every page on the same slate; the shell step
  becomes what it is on the web — the well a field, an avatar disc or a floating action is cut into.
  The visible consequence is in the dark presentation, where the page behind the cards deepens from
  the shell's step to the canvas's; the light presentation keeps the same near-white family it had.
  Nothing about the cards, bars or sheets moves, because each of them already draws its own surface
  and its own hairline against whatever it stands on.
- **The danger wash is the web app's wash.** The failure banner and the scheme's `errorContainer` now
  read the shared `danger-soft` instead of a tenth of the danger ink, so the light presentation's
  banner sits on GitHub's `#f85149`-derived wash rather than on `#cf222e`, and the dark one is the
  stronger 14% the web uses. The banner's boundary is the app's own edge tone: the edge and the fill
  are two tones, because an edge drawn in the fill it bounds is not an edge.
- **An empty page's glyph is a noun, not an action.** A page-level empty state paints its mark in a
  text tone and keeps the Accent for primary actions, the selected state and focus; a failure's mark
  stays in the danger tone, because a failure is the one status such a page reports.
- **The dialog entry point names its own barrier.** `showGitPulseDialog` supplies the platform's
  `modalBarrierDismissLabel` itself; the three call sites that repeated it pass nothing, and a caller
  overrides the label only when a barrier means something other than "dismiss".
- The interaction contract is now asserted in two places, and both must keep passing: the
  theme-level test reads the ink the framework is handed by the app's own controls and by the two
  Material families a retained face still draws, and each face's own test reads what a reader gets —
  a press, a hover, a disabled control that refuses, a tooltip, a dialog that dismisses.
- A Flutter upgrade can no longer restyle the faces a reader operates. What is left to Material is
  the list above, and each entry on it is a behaviour the platform does better than the app would.
- **The switch and the checkbox are GitPulse's now.** They were the last gap in this record's
  coverage, and closing it removed the `checkboxTheme` ink installation rather than leaving it
  behind: the client draws no Material checkbox or switch, so there is nothing for such an entry to
  restyle.
- Two small visible changes follow from the geometry the faces keep rather than choose: an icon
  action in Settings is now one 40dp-square target instead of Material's padded 48dp variant, and
  the Settings row that clears the timeline cache reports success with the **success** tone on its
  check mark rather than with the Accent — a confirmation is a receipt, and the Accent means the app
  is acting (ADR 0031).
- A third small visible change follows from the toggles' own drawing: the Timeline Filter Panel's
  date bounds are two `GitPulseButton` pills at the app's control height instead of Material's 32dp
  `OutlinedButton`s, and the box at each repository row's end draws the app's own 18dp box. The panel
  keeps the row rhythm it had — a repository row still stands at `GitPulseHeight.rowMin` — because
  the box takes the square the row has left rather than a target of its own.
- The theme's own Material component themes were the last thing this record could not settle until
  every screen had moved: `outlinedButtonTheme` and `dialogTheme` are deleted, `checkboxTheme` went
  with the toggles, and the two families a retained face genuinely draws keep theirs. Deleting them
  is the proof the decision is finished rather than merely recorded, and the app-wide test fails if
  one comes back without a screen that draws its family.
- **What the client no longer contains.** No screen mounts Material's button family, navigation bar,
  switch, checkbox, dialog or progress face; no app code outside the tone and type modules reads one
  of Material's colour roles or type roles; no surface states a colour literal or a font size; and
  the constant that called itself the brand is not in the tree. The green the client used to build
  itself out of is reachable only as the success tone, on a receipt and never on an action. What is
  left to Material is the exception list above, and each entry on it is a behaviour the platform
  does better than the app would.
