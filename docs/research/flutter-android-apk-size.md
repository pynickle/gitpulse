# Flutter Android APK size evaluation

Measured on 2026-10-30 at commit `eb762e753a92d800ac3ea8e0e2ccf3d58b85ee11`.
The input is the owner-provided
`GitPulse-flutter-v0.1.0-android-arm64-v8a.apk`, reported as a GitHub Actions
artifact from that commit. Measurements are also recorded in
[the JSON results](./flutter-android-apk-size.json).

## Result

Splitting Dart debug information is worth adopting before changing dependencies.
In a controlled local Android arm64 release compilation, the stripped
`libapp.so` shrank by **1,245,184 bytes (1.1875 MiB, 14.50%)**. Because this
library is stored uncompressed in the input APK, the projected whole-APK saving
is **5.25%**, from **22.61 MiB to approximately 21.43 MiB**. The latter is an
estimate, not a newly built APK measurement.

No application code, dependencies, Gradle settings or release workflow were
changed. Native-library compression and Dart obfuscation were not enabled.
There is no measured reason here to replace the database, WebView or state
management stack.

## Environment and method

- Windows host; Flutter 3.47.8, framework revision `737ba8f885`, engine revision
  `cf636b1dfb`, bundled Dart 3.13.7.
- Existing resolved dependency graph, current `lib/main.dart`, release mode,
  Android arm64, widget-creation tracking disabled.
- `flutter assemble` generated one release kernel. The SDK's Android arm64
  `gen_snapshot.exe` compiled that same kernel twice using `--deterministic`.
- Both runs emitted V8 snapshot profiles and precompiler traces. The split run
  additionally used the three flags that this Flutter SDK supplies for
  `--split-debug-info`: `--dwarf-stack-traces`, `--resolve-dwarf-paths`, and
  `--save-debugging-info=<symbols-file>`. Neither run used `--obfuscate`.
- Both ELF files were stripped with NDK 28.2.13676358's
  `llvm-strip --strip-unneeded`, modeling the Android packaging stage rather
  than comparing the larger intermediate ELF files.
- Attribution uses `vm_snapshot_analysis` 0.7.6, the parser Flutter itself uses.
  The results include snapshot data as well as machine instructions. Shared
  objects are kept in shared/VM buckets, not counted once per dependency.
- The local baseline `libapp.so` and the APK's `libapp.so` have exactly the same
  length, but different SHA-256 hashes and differing code/data sections. The
  local build therefore does not establish byte-for-byte CI reproduction.
  The saving is a local paired experiment on the current source.
- This host has no `android/key.properties`. No signed APK was produced, no
  signing checks were bypassed, and no device/runtime acceptance was run.

## Measured sizes

| Item                             | Baseline bytes | Split bytes | Reduction |
| -------------------------------- | -------------: | ----------: | --------: |
| Stripped `libapp.so`             |      8,586,120 |   7,340,936 | 1,245,184 |
| Intermediate unstripped `app.so` |     12,462,584 |  11,465,664 |   996,920 |
| Snapshot-accounted bytes         |      8,510,592 |   7,265,984 | 1,244,608 |
| ELF `.rodata` section            |      3,298,400 |   2,053,744 | 1,244,656 |
| ELF `.text` section              |      5,212,192 |   5,212,240 |       -48 |

The external `app.android-arm64.symbols` file is **4,191,160 bytes**. It belongs
with the build's retained diagnostic artifacts, outside the installable APK.
Its size is not the APK saving: symbol files carry information in a different
format, and Android already strips ELF debug sections from a normal release.

Executable instructions are essentially unchanged. The main reduction is
snapshot metadata: the baseline profile attributes 469,557 bytes to
`CodeSourceMap`, versus none in the split profile; `Function` falls from
352,973 to 91,038 bytes, and `Code` from 328,866 to 49,456 bytes. This explains
why split debug information still helps an APK whose ELF debug sections have
already been stripped.

The input APK is 23,712,366 bytes. Subtracting the local stripped-library delta
gives a projected 22,467,182 bytes, subject to actual packaging, page alignment
and signing overhead. Installation size was not measured.

## Where the remaining Dart bytes go

These are attributed bytes in the **split** snapshot, not native `.so` library
sizes or guaranteed savings from removing packages. Attribution is approximate
and shared objects can move between buckets when dependencies change.

| Package/group                  |     Bytes | Interpretation                                               |
| ------------------------------ | --------: | ------------------------------------------------------------ |
| Flutter framework              | 2,654,416 | Largest named package; widgets, rendering, text and controls |
| GitPulse application           |   590,281 | All app libraries combined                                   |
| Flutter localizations          |   169,338 | Framework control translations                               |
| Material UI                    |   117,367 | Flutter UI implementation dependency                         |
| Drift                          |   108,674 | Dart database/query code, separate from native SQLite        |
| Riverpod                       |   102,070 | Plus 11,290 bytes in `flutter_riverpod`                      |
| Intl                           |    98,698 | Formatting/localization                                      |
| WebView Dart packages combined |    91,050 | Interface, Android implementation and facade                 |
| GoRouter                       |    65,362 | Routing                                                      |
| Material color utilities       |    63,937 | A possible investigation target, not proven removable        |
| Dio                            |    50,052 | HTTP client, excluding supporting packages                   |
| SQLite Dart bindings           |    44,637 | Separate from the native library                             |
| JNI Dart bindings              |    30,764 | Separate from the native JNI library                         |

VM objects, shared data and Dart SDK libraries account for much of the rest.
For example, the split profile contains 774,179 bytes in `@unknown`, 164,902
in `@stubs`, and 327,987 attributed to `dart:mixin_deduplication`. These are
not unexplained application dependencies that can simply be deleted.

The largest attributed application libraries are timeline cache (49,521 bytes),
timeline session (46,090), timeline screen (31,896), session controller (23,954),
and release drawer (21,401). No single application library dominates the APK.

## Dependency findings

- **Marionette:** `lib/main.dart` gates initialization with `kDebugMode`.
  No `marionette_flutter` package appears in either release profile's attributed
  package list. Removing the development integration is not a demonstrated
  release-size optimization.
- **WebView:** the APK contains no bundled Chromium engine. Android uses system
  WebView; the app's document JS/CSS occupies only 114,616 compressed bytes.
  Replacing this established renderer would be a functional/architectural
  change for limited demonstrated payload savings.
- **SQLite:** the 1,749,200-byte native library backs the offline timeline cache.
  Custom SQLite builds can omit features, but require an additional maintained
  native build and have not been measured here. Replacing SQLite is not
  justified by this evaluation.
- **JNI:** `path_provider_android` brings in JNI support, used by application
  support-directory storage for preferences and the timeline cache. The native
  `libdartjni.so` is only 131,248 bytes; it is not an unexplained large payload.
- **Framework/localization:** these have measurable retained contributions, but
  changing supported locales, controls or platform behavior would require its
  own scoped experiment. A package's retained bytes are not a removal plan.

ADR 0028 still describes Windows/WebView2 paths; ADR 0029 and the current
platform directories establish Android/iOS only. The Android system-WebView
finding follows the current implementation and the newer platform decision.

## Recommended next change

Add `--split-debug-info=build/symbols` to the existing signed, split-ABI release
build. Keep the generated ABI-specific symbol files with the exact commit,
version/build number and workflow run that produced their APKs. They must
remain available for every distributed build that may still produce a crash.
Do not put the files into the APK or rely on short-lived Actions artifacts as
the only long-term copy.

This changes crash diagnosis: raw Dart stack traces require the matching
symbols and `flutter symbolize`. It does not require enabling obfuscation.
The measured benefit is approximately 1.19 MiB for arm64; other ABIs have not
been measured. A follow-up implementation should verify the signed APK sizes
in CI and confirm symbolization with that build's symbols. Installation and
update acceptance remain owner-run.

## Reproduction and local artifacts

Local experiment files live under the ignored `flutter/build/size-evaluation/`:
`baseline/` and `split/` contain stripped/unstripped ELFs, snapshot profiles and
precompiler traces; `split/` also contains symbols. `attribution.json` records
the full package/library attribution. `treemap/index.html` is an interactive
code/data treemap generated by the official snapshot-analysis tool; no browser
or development server was started.

The kernel command, from `flutter/`, was:

```powershell
flutter assemble --no-version-check '-dBuildMode=release' '-dTargetPlatform=android-arm64' '-dTrackWidgetCreation=false' '--output=build/size-evaluation/kernel' '--build-outputs=build/size-evaluation/kernel-outputs.txt' kernel_snapshot_program
```

The generated kernel for this run is
`.dart_tool/flutter_build/847bcae55cb0a865bfd4dd347fa5cad4/app.dill`.
That directory name is configuration-dependent. Each snapshot run used:

```text
<flutter-sdk>/bin/cache/artifacts/engine/android-arm64-release/windows-x64/gen_snapshot.exe
  --deterministic
  --snapshot_kind=app-aot-elf
  --elf=<variant>/app.so
  --write-v8-snapshot-profile-to=<variant>/snapshot.arm64-v8a.json
  --trace-precompiler-to=<variant>/trace.arm64-v8a.json
  [split flags listed above, for the split variant only]
  <release-kernel>/app.dill

<ndk>/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-strip.exe
  --strip-unneeded -o <variant>/libapp.so <variant>/app.so
```

The installed official analyzer was run with the Flutter tool's package config:

```powershell
dart --packages=D:/flutter/packages/flutter_tools/.dart_tool/package_config.json D:/PubCache/hosted/pub.dev/vm_snapshot_analysis-0.7.6/bin/analyse.dart summary --by package build/size-evaluation/split/snapshot.arm64-v8a.json
```

For a future measurement on a host with the release identity configured, the
standard supported path is `flutter build apk --release --no-pub
--target-platform=android-arm64 --analyze-size`, then repeat with
`--split-debug-info=build/symbols`. Compare the actual packaged APKs as well as
their size profiles. That full build was not run in this evaluation.

## References

- [Flutter: measuring and reducing app size](https://docs.flutter.dev/perf/app-size)
  recommends evaluating `--split-debug-info` and package-level size analysis.
- [Flutter: symbol files and symbolization](https://docs.flutter.dev/deployment/obfuscate)
  documents keeping symbols and restoring readable stack traces.
- Installed SDK: `packages/flutter_tools/lib/src/base/build.dart` supplies the
  three split flags; `build_system/targets/android.dart` supplies the snapshot
  and trace flags; `base/analyze_size.dart` uses `vm_snapshot_analysis`.
