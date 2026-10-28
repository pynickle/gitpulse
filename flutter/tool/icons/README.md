# Native app icons

From the repository root, regenerate the Android and iOS sets with:

```sh
uv run --locked flutter/tool/generate_app_icons.py
```

Install `uv` and the Flutter SDK pinned in `flutter/pubspec.yaml` first. The
script's inline metadata and adjacent uv lockfile supply Python 3.15 and
Pillow 13.0.0 in a uv-managed environment. It resolves the committed Dart lockfile,
runs `flutter_launcher_icons` 0.14.4, applies the corrections below, and runs
`flutter/test/app_icons_test.dart`. A failed self-check exits nonzero.
Do not run `dart run flutter_launcher_icons` alone: it omits those corrections.

Commit the generated sources, platform binaries, catalogs, configuration and
lockfiles together. Normal builds and CI need neither uv nor Pillow.
`generated/` is tooling input, deliberately absent from Flutter's runtime asset
declarations.

## Artwork ownership

The existing web mark is the only hand-maintained artwork. The script reads
`public/icon.png` and its existing light-mark state `public/icon-dark.png`
without changing either. All client copies in `generated/` are derived:

- `mark.png` recovers alpha from the opaque, 39-colour brand palette. Coverage
  is estimated against its two dominant mark colours, preserving palette
  residuals. The almost-white background (254, 254, 254) becomes transparent.
  Recomposition over pure white must differ by at most 2/255 in any channel.
- `square.png` is the recovered mark over pure white. The original proportions
  remain: about 613 × 383 inside a 1024px canvas, horizontally centred.
- `dark.png` normalizes the existing light-mark state's background alpha from
  15/255 to zero. `tinted.png` desaturates the **dark** mark over white so the
  tinted appearance retains contrast.
- `monochrome.png` is a black silhouette with the recovered mark's alpha.

For a future brand change, update the existing brand states and rerun the
command; do not edit the derived sources or individual platform files.

## Platform output

- **Android:** traditional 48/72/96/144/192px mipmaps for API 24–25; adaptive
  foreground and monochrome layers at all five densities. The 8% inset brings
  the mark within Android's guaranteed central 66dp circle on its 108dp layer.
  The background is white. Android 12+ uses the launcher icon for its default
  system startup screen; no separate splash artwork is introduced.
- **iOS:** the generator's complete current universal size set, light/dark/tinted
  appearances, and an opaque RGB 1024px marketing image. Obsolete unreferenced
  PNGs are removed from this generated catalog. The script preserves the existing
  Xcode project: generator 0.14.4 otherwise rewrites unrelated `ASSETCATALOG`
  settings even though `AppIcon` is already configured.

The delegated average resampler sometimes truncates white to 254; the owned step
restores near-white backgrounds to pure white.

## Verification

`flutter test --no-pub test/app_icons_test.dart` decodes committed PNG files and
parses XML/JSON/YAML platform configuration. It checks brand recomposition,
dimensions and catalog coverage, adaptive safe zones and themed layers, iOS
alpha and contrast, and exclusion of tooling sources from runtime assets. The
existing Flutter CI runs this contract on every change, including the iOS
artifacts on Linux.

After regeneration, running the command again should leave every artifact
byte-identical. Keep the Python/Pillow, Flutter SDK and Dart lockfiles pinned
when comparing generated output.

Owner acceptance still requires an installed Android APK (circular mask,
Android 13+ themed icon, Android 12+ startup and API 24–25 traditional icon).
The iOS catalog checks do not substitute for running Xcode on macOS/iOS.

References: [flutter_launcher_icons configuration](https://github.com/fluttercommunity/flutter_launcher_icons#book-guide),
[Android adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive),
[Android system startup screen](https://developer.android.com/develop/ui/views/launch/splash-screen).
