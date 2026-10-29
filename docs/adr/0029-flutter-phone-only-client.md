---
status: accepted
---

# The Flutter client is one phone layout, on Android and iOS only

The client was specified for five platforms (ADR 0015), and its layout was built for the two
extremes of a desktop window: a Navigation Rail, one to three date-grouped Timeline columns, a
Release Drawer that became a right-side panel one column wide (ADR 0018), a right-side filter panel,
a Followed Repositories sidebar and a two-column Settings page. Only Android was ever built and run.
The other four targets were code-level claims, and every wide variant was a second answer to a
question the phone layout already answers — never executed by anyone, and never measured against the
column metrics it was derived from.

The client is now a phone client: Android is the platform it is built, released and run on, iOS keeps
its platform code and configuration, and Windows, macOS and Linux have no platform directory, no
packaging script, no icon output and no CI job. There is no window-width decision anywhere in the
app. The shell always shows the bottom navigation bar, the Timeline is always one column, the Release
Drawer and the Release Timeline Filter Panel always open as bottom sheets, Followed Repositories
always live behind the `manage-follows` button, and Settings is always one column of cards with the
account card at its head. `flutter/windows`, `flutter/macos` and `flutter/linux` are gone, as are
`tool/package_windows.ps1`, `tool/package_windows_setup.ps1`, the Windows setup job in
`flutter-release.yml`, the Windows and macOS icon artwork, and the publishing rows that named them.

**What this changes in the code.** `resolveTimelineColumnCount`, `releaseDrawerPanelWidth`, the
`GitPulseWidth.timelinePhone`/`timelineTablet` breakpoints and `GitPulseSpace.columnGap` are removed;
a Timeline row is one `ReleaseTimelineCard`, so `_CardsRow` no longer wraps the card in a `Row` of
`Expanded` cells under an `IntrinsicHeight` — that intrinsic pass existed only to even out heights
across cards sharing a row, and a single card has nothing to compare against. The desktop-only
system-typeface switch (`gitPulseTypography`) is removed with the platforms that needed it: on
Android and iOS the platform's own typeface already carries the chosen language.

**One sheet presentation.** Both overlays are now the same surface, so the presentation itself became
a module: `showGitPulseSheet` (`lib/presentation/gitpulse_sheet.dart`) owns the route, its barrier,
the slide it makes from and back to the bottom edge, the rounded sheet surface and the Escape key, and
a sheet body decides only its content and height. Two copies of that scaffold could disagree — the
drawers' copy had no entry animation and the filter panel's copy re-declared the surface — and the
deletion test settles the shape: removing the module puts five decisions back into every overlay. As
one surface, the filter sheet takes `GitPulseRadius.sheetTop` like the release sheet, where ADR 0019
had named 12dp for a panel that also opened at the window's right edge.

**A sheet moves; it never fades.** Arriving and leaving are one translation of the sheet by its own
height over `gitPulseSheetTransition`; the barrier still fades, but nothing on the sheet does, and the
route's own default transition (which fades the page it holds) is passed through untouched. The Release
Drawer's closing flash is the reason to keep it that way: its notes were drawn by a hybrid-composition
WebView, which ignores the opacity of the surface it stands on and tore down with one stale frame of
the whole sheet, so a faded sheet left the notes lit while everything else went. The notes are a texture
now (ADR 0028) and would compose, but putting a sheet away is a movement, and an opacity layer over any
platform view is the fragile path that already flashed once. A sheet body is therefore never wrapped in
an `Opacity` or an alpha-blended `AnimatedOpacity` either.

**What this does not change.** Auth, cache, retention, documents, follow semantics and the sheet
geometry ADR 0010 and ADR 0018 fix are untouched. A page-level _ceiling_ is not a wide-screen branch
and stays where a page has one: the reading measure on a repository page, the scanning ceiling on
Settings and the content width on Follows bound a single column at any width, so a tablet or an
ultra-wide window shows the same layout with the same line lengths instead of a second composition.

## What it partly supersedes

- **ADR 0015** fixed the client as its own product boundary on five platforms. The boundary stands;
  the platform list is now Android and iOS.
- **ADR 0017** chose polling over callback links partly because it works "on all five platforms".
  Polling is unchanged; the count is two.
- **ADR 0028** records a Windows/WebView2 packaging requirement and treats Windows as one of two
  shipping engines. The renderer, the address policy and the bridge stay; Android's system WebView is
  the one engine that is built and accepted.
- **ADR 0018** describes a wide panel exactly one Timeline column wide. That paragraph is superseded;
  the rest of that ADR (chrome line, reading-first body, notes type scale) still governs the sheet.
- **ADR 0010**'s desktop/mobile crossing note no longer has a Flutter counterpart: there is one
  presentation, so nothing resets when a window changes size.

## Consequences

- `Escape` still dismisses a sheet, because a hardware keyboard is a normal Android input device; it
  is no longer described as a desktop behaviour, and one module now answers it for every sheet.
- A wide window shows the phone layout, with the content centered by the page's own ceiling. The
  `test/` suites assert one column at 320, 500, 900 and 1400dp rather than an adaptive count.
- Reintroducing a desktop target is a new decision: it needs a new ADR, a platform directory, a
  packaging job with its own signing/verification story, and device acceptance. Code that anticipates
  it — breakpoints, an unused rail, a platform switch nobody runs — is not a partial substitute.
