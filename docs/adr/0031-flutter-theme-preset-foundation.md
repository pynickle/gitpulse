---
status: accepted
---

# The Flutter client presents one Theme Preset: GitPulse's palette and GitPulse's type

Material is the client's runtime, not its design language. A **Theme Preset** — the named set of
Foundation Layer values a client presents in full — now holds every tone and every type row the
Flutter client draws with, and the client's theme is a mapping of that preset onto Material's
`ColorScheme` and `TextTheme` rather than a scheme Material generated.

`ColorScheme.fromSeed` is gone. It seeded Material's tonal algorithm with `#238636`, which is the
web app's _success_ tone, so the client built its whole identity — the five neutral steps, the two
outlines, the two text tones, the Accent — out of a colour that means "this succeeded" on the other
client, and out of an algorithm nobody chose. The preset's palette is the `gitpulse` palette the web
app already presents, declared once in `shared/data/theme-palette.json` and read here through
generated, committed constants (`lib/presentation/gitpulse_palette.g.dart`, regenerated with
`dart run tool/generate_theme_palette.dart`). The tone names are the design's own — `shell-bg`,
`surface`, `surface-muted`, `border`, `text-strong`, `accent`, `success` — and neither client renames
them. `GitPulseColors.brand` is deleted: the constant that called itself the brand colour was the
success tone wearing the wrong name.

**The Accent** is the web app's indigo, `#4f46e5` in the light presentation and `#a5b4fc` in the dark
one, and `#238636` is carried only as a success tone (`success-solid` in the dark presentation). A
green confirmation no longer reads as the brand, and an Accent-coloured control no longer reads as a
receipt. This is the most visible change in the work and it is the point of it: GitPulse's Accent is
defined where the product already defined it.

## The preset

`gitPulsePreset` (`lib/presentation/gitpulse_preset.dart`) carries the light palette, the dark
palette and one type table, and `gitPulsePresets` is the registry: exactly one entry, `gitpulse`.
There is no reader-facing preset choice and no preset field in Device Preferences — a preference that
can only hold one value is not added — and the registry exists so that a second preset later is a data
addition rather than a redesign. The theme carries the preset it presents as a `ThemeExtension`
(`GitPulseFoundation`), so app code reads the preset the theme actually has instead of reaching past
it for a global.

## The mapping onto Material

`gitPulseColorScheme` fills Material's roles one by one. Nothing is generated, and the pairings
Material requires are stated rather than left to a fallback, so a retained control — a text field's
decoration, a snackbar, the date picker, a divider — reads coherent values in both presentations.

- `primary` is the Accent, `onPrimary` the surface under a light Accent and the shell under a dark
  one; `primaryContainer` is the Accent's soft wash with the Accent reading back on top.
- `secondaryContainer` is the active step and `onSecondaryContainer` the Accent: the selected row, the
  chosen chip and the navigation bar's indicator all take one tone, in the Accent's family.
- `error` is the danger tone and `onError` reads on it; `errorContainer` is that tone as a wash at
  `gitPulseStatusWashAlpha` (one tenth, the proportion the web app's own danger-soft uses), with the
  danger tone reading back on top.
- `surface` is the card's tone and `onSurface` is `text`, `onSurfaceVariant` is `text-muted`; `outline`
  is `border-strong` and `outlineVariant` is `border`, which is why `toneEdge` and `toneRule` keep
  their meaning without changing a line.
- The neutral containers are filled by job rather than as a ladder of five. `surfaceContainerLowest`
  is the shell — what a surface sits on; `surfaceContainerLow` and `surfaceContainer` are the muted
  surface — a block within one; `surfaceContainerHigh` is the shell again, because that is the step a
  surface cuts a well _into_ (a field's own fill, an avatar's disc, a picker's chrome); and
  `surfaceContainerHighest` is the active step, the palette's strongest in either presentation.
- `inverseSurface`/`onInverseSurface` are a snackbar's pair (strong text tone under a surface tone),
  and `scaffoldBackgroundColor` is the shell tone, so a page is the web app's slate and a card is the
  surface standing on it.

Dialogs and the date picker are then given the surface tone explicitly, because that is the tone the
app's own sheets already paint; a Material overlay reads as one of GitPulse's overlays instead of as a
component with a tone of its own.

## The type table

One table authors the eight roles the client sets — `bodySmall`, `bodyMedium`, `titleSmall`,
`titleMedium`, `labelSmall`, `labelMedium`, `headlineSmall`, `headlineMedium` — with size, weight,
line height and letter spacing that are GitPulse's, authored against the platform's family (Roboto on
Android; no font is bundled, and a bundled font would be its own decision). The reading scale a notes
or README document is set in is four more rows of the same table: the body at 15 on a 24 line, and
three heading tiers on one 1.35 line. Nothing about the reading surface is a special case beside the
table any more.

Line heights run looser than Material's — 1.35 to 1.5 through the chrome — because the client is read
in Chinese as well as in English, and a Chinese line needs the room a Latin one does not. Sizes moved
only where the app's own geometry allowed it: the page title's 22 is the table's `headlineSmall`, the
body's 14 is the one the page pill's number cell was measured at, and the section label stays 11
because the Timeline's Previous Refresh marker sets it inside a row the chrome does not get to
re-flow.

`ThemeData.textTheme` is the platform's own typography with those eight roles re-authored on top, so
the roles the table does not name (`bodyLarge`, the display sizes, `labelLarge`) still reach a
retained control. The `gitPulseType*` helpers read the same roles out of that theme and decide only
the colour — and, where one role carries two jobs, the weight. No helper states a size, a line height
or a letter spacing, so a role cannot disagree with itself.

## Semantic reading

App code stops taking its tones from Material's roles and takes them from the preset. The readers live
beside `toneEdge`/`toneRule` in `lib/presentation/gitpulse_tokens.dart`, in the same shape — free
functions named `tone…` — and take the `BuildContext` the app's type helpers take: `toneShell`,
`toneSurface`, `toneSurfaceMuted`, `toneSurfaceRaised`, `toneSurfaceHover`, `toneSurfaceActive`,
`toneBorder`, `toneBorderStrong`, `toneText`, `toneTextStrong`, `toneTextMuted`, `toneTextSubtle`,
`toneAccent`, `toneAccentSoft`, `toneSuccess`, `toneSuccessSolid`, `toneDanger`, `toneDangerSolid` and
`toneDangerSoft` (the danger tone as a wash). Between them they cover every tone the client currently
takes from a Material colour role.

The readers resolve through `GitPulseFoundation`, which the theme carries; a widget mounted outside
`gitPulseTheme` — a probe, a preview, a test — reads the product preset's tones instead of throwing,
because there is one preset and that is the tone the app would have shown.

This ticket migrates no call site: the 103 reads of Material's colour roles and the 61 reads of its
type roles still read them when it lands, and converge onto this vocabulary in later work. What
changes here is what a reader sees — the palette, the Accent, the page tone and the type are the
product's from the moment it merges — and what later work has to read instead.

## What of ADR 0019 stands

ADR 0019's tonal interaction tint stands, and so does every rule around it: no surface sets its own
overlay colour, ink sits below a surface's children (which is why the Release Timeline card paints its
own surface through `Ink`), the Release Asset rows open a download from the whole row, the notes and
the asset module are separated by a boundary rather than a nested card, and download sizes stay
humanised. ADR 0023's rule — a press paints nothing, hover and keyboard focus paint the one
half-strength tint — stands unchanged, and its consequences still describe the behaviour.

What no longer stands is the tint's _tone_: ADR 0019 defined it as the seeded scheme's highest surface
container at half strength. That role is now the preset's active step, so the tint is the Accent's own
wash laid on lightly, which is what keeps a hover or a focus ring visible on a white card. The ink
contract itself — nothing on press, one tint on hover and focus — is unchanged, and the existing theme
test that asserts it through the framework passes without an edit.

## Consequences

- The client's appearance changes app-wide at once: the page is the shell's slate, cards are the
  surface, the Accent is indigo, a confirmation is GitHub's green and nothing else is, and the type is
  the table's. No screen gets a local theme override during the pilot; a second theme would hide
  exactly the cross-screen failures the pilot exists to find.
- A Flutter upgrade can no longer restyle the client. `ColorScheme.fromSeed`, Material's scheme
  variants and the M3 page-transition springs can change under a dependency bump and the app's tones
  and type do not move with them, because the app no longer asks Material for either.
- The neutral steps are filled by job, not by a five-rung ladder: `surfaceContainerHigh` is the shell
  and the lowest step is the shell too. A reader who expects Material's monotone container ramp will
  find GitPulse's ramp instead. The next role that needs a step the palette does not carry is a data
  change to the shared palette, not a literal in a widget.
- The soft danger wash, `toneDangerSoft` and `errorContainer`, is derived from the danger tone at one
  declared proportion rather than added to the shared data; the web app derives its danger-soft the
  same way. If a second client ever needs it at another strength, the value belongs in the data.
- Three type sizes did not move — the body's 14, the section label's 11 and the row name's 14 — because
  measured controls and one long-standing row are built around them. The table owns them anyway, so
  moving one later is one edit and one regression test, not a hunt.
- Tests that assert GitPulse's own type or tone must mount `gitPulseTheme`. A screen measured under a
  bare Material theme is now measured against Material, which is a true statement about that theme and
  not about the app.
- The theme-level test (`test/presentation/gitpulse_theme_preset_test.dart`) asserts, in both
  presentations, that the semantic tones resolve to the shared data's values, that each of the eight
  roles resolves to the table's size, weight, line height and letter spacing, that the paired `on…`
  roles read on the colours they sit on, and that the interaction contract still resolves to no press
  tint and one hover/focus tint. The control layer (ADR 0032) inherits these tones and this table; it
  does not restate them.
