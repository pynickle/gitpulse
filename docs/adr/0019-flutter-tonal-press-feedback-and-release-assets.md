---
status: superseded
superseded-by: 0032-flutter-control-layer.md
---

# Flutter surfaces answer a tap with a tonal shift, and Release Assets read as their own module

> The tonal tint this record introduced, and the ink rule around it, are now owned by ADR 0032
> (which supersedes ADR 0023 as well). Everything else below still governs: the ink-below-content
> failure, the Release Asset rows opening a download, the notes/assets boundary and the humanised
> download sizes.

Press and hover feedback is one theme-level decision, not a per-surface style. `gitPulseTheme`
sets the Material ink response's pressed and splash tint to the scheme's highest surface container
and its hover and focus tint to the same tone at half strength, so light mode moves one step along
the surface ramp instead of darkening toward black and dark mode brightens instead of greying out.
No surface sets its own overlay colour; a surface that wants rounded feedback clips the ink to its
own shape instead — the Release Drawer's chrome row and the Release Asset rows at 8dp, the Release
Timeline card at 12dp. Because ink is painted below a `Material`'s children, a surface painted by an
opaque child answers a press with nothing at all: the Release Timeline card now paints its own
surface through `Ink` for exactly that reason. A future reader should not reintroduce a darkening
overlay, and should not put an opaque container above an ink response.

The Release Asset row shows the complete filename. Thirty-one build artefacts differ by `x86_64`
against `arm64`, and by `.zip` against `.zip.minisig`; an ellipsis can hide precisely the part the
reader is comparing, so the name has no line limit and no overflow, and wraps instead. Do not "fix"
that wrapping back into a single ellipsised line.

The notes and the Release Asset module are separated by a boundary — 24dp of space, a hairline rule
in the outline-variant tone, then 16dp — rather than by nesting a tonal card inside the drawer. The
drawer already is a surface, and a second container fights its padding; the rule says where the
notes ended, which is what the reader needed. The fold row became the module's own section label
(small label type, added letter spacing, medium weight, muted colour, a paper-clip glyph, the count,
the total size, and a chevron that rotates), taking over ADR 0018's fold-row typography while
leaving its folding behaviour, chrome slots and reading-first stance intact. Sheet geometry and the
wide panel's derived width remain ADR 0010's and ADR 0018's; only the content inside the panel
changes.

Download sizes are humanised by `formatGitPulseByteSize` in the presentation formatting layer, in
the shape of the existing date formatters: locale-aware numbers, kilobytes rounded to whole numbers,
megabytes and gigabytes to one decimal, unit symbols supplied by localisation, and nothing at all
for a size of zero — the value GitHub reports when the size is unknown.

## Consequences

- The tonal tint is app-wide by design. Timeline cards, the Release Timeline Filter Panel and the
  repository lists change appearance when pressed or hovered; that is the cost of deciding it once.
- A press on a Release Timeline card had no visible feedback before, because its opaque surface sat
  above the ink layer. That card now changes tone like everything else.
- Asset rows no longer show a MIME type, a per-asset date, the deprecated per-asset label, a trailing
  download button or the per-request footnote. The whole row opens the download, so nothing steals
  width from the filename.
- The Release Timeline card's per-asset-count wording is untouched: it is a different surface with
  different copy, and the drawer's fold row owns its own localisation entries — plural in English,
  plain in Chinese, plus a count-only variant for a release whose assets all report an unknown size.
- The theme owns the tint of Material ink responses, not of every Material widget. Material 3
  `IconButton`s and the other button families resolve their own overlay (a 10% `onSurfaceVariant`
  tint, already clipped to a round shape), and `ChipThemeData` exposes no overlay hook at all, so
  making those tonal is a separate decision rather than part of this one.
- Because the press tint is exactly the highest surface container tone, content that paints itself in
  that same tone loses contrast for the duration of a press; new tints, chips and badges on a tappable
  surface should pick a different step than the press tone. The one instance this ADR produced — the
  Release Timeline card's prerelease badge at `surfaceContainerHigh` — is gone: the badge is now the
  shared outlined `GitPulseStatusBadge`, which paints no fill at all (ADR 0020). The rule survives the
  instance, because the next badge that does fill itself still needs it.
