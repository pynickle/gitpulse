# Flutter distribution and acceptance

GitPulse's native client lives in `flutter/`, uses application identity
`ink.euphony.gitpulse`, and has its own `flutter-vX.Y.Z` tags. Its release workflow
prepares three signed Android ABI APKs. There is no universal APK. Pushing
the matching `flutter-vX.Y.Z` tag creates a draft GitHub Release titled
`GitPulse Flutter vX.Y.Z` and attaches those files. It does not deploy Nitro or
publish the extension. Main app `vX.Y.Z` and extension `extension-vX.Y.Z`
workflows retain their separate triggers.

Android is the only platform this project builds and runs; iOS keeps its platform
code and configuration, and nothing else is a supported target (ADR 0029).

## Reproducible toolchain

Run Flutter commands from `flutter/`. The exact stable Flutter SDK is recorded in
`pubspec.yaml` under `environment.flutter`; CI reads that value. Use the bundled
Dart SDK and commit `pubspec.lock`. Flutter does not participate in the Bun
workspace or Nuxt discovery. The root web checks still run independently.

The current pin is Flutter 3.47.9 stable with its bundled Dart 3.13.7.

Android uses AGP 9.4.1, Gradle 9.8.2, and built-in Kotlin. The Kotlin compiler
stays pinned to 2.4.21 to satisfy Flutter's minimum version and the JVM 25 target;
the Kotlin Android plugin is declared with `apply false` and is not applied.
Flutter 3.47 still needs `android.newDsl=false`, so warnings about the legacy
AGP DSL and variant API are expected. Keep `android.builtInKotlin=true` explicit
so Flutter's migrator does not restore the Kotlin opt-out. The Gradle Wrapper
scripts and JAR are tracked; update them with the `wrapper` task when upgrading
Gradle, rather than changing only the distribution URL.

The 2026-10-20 audit resolved Flutter 3.47.7 / Dart 3.13.5. All selected runtime
dependencies resolve to their current compatible stable releases. The compatible
generator update is included in the lockfile. `build_runner` remains at 2.16.2:
the newer 2.17.x needs `build` / `build_config` versions incompatible with the
selected generators. SDK-pinned/transitively constrained packages are not forced
past their constraints, and no floating Git dependency or override is introduced.

```sh
flutter pub get --enforce-lockfile
flutter analyze --no-pub
dart format --output=none --set-exit-if-changed lib test
flutter test --no-pub --reporter expanded
```

`flutter test` needs Bun and the root `bun install --frozen-lockfile`: contract
tests start controlled loopback Nitro fixtures and keep separate browser/app
cookie jars. They do not use production credentials. `flutter-ci.yml` runs these
checks on pull requests and master and is reused by the release workflow. The
existing root format, lint, Nuxt typecheck, extension typecheck and web build CI
jobs remain required. Run root/extension regression tests locally before pushing;
the main web production build stays CI-only.

## Android release identity

Use the **same existing private signing key and certificate for every update**.
The application ID stays `ink.euphony.gitpulse`. The release build has no debug
signing fallback: incomplete signing configuration, the `androiddebugkey` alias,
or a missing keystore fails the release build. Debug builds remain development
artifacts. An earlier debug-signed installation cannot update to the formal
release identity; uninstalling it removes its local data and requires signing in
again. Do not solve a signature mismatch by changing the formal release key.

For local builds, copy `flutter/android/key.properties.example` to the ignored
`flutter/android/key.properties` and fill in the owner's existing values. Use an
absolute keystore path with forward slashes. Keep the key outside the
checkout and back it up privately. Environment variables override `key.properties`
when Gradle is started directly. `flutter build apk` does not pass them into
Gradle and reads `key.properties` instead. The mapping is:

| Gradle property | Environment variable              |
| --------------- | --------------------------------- |
| `storeFile`     | `GITPULSE_ANDROID_KEYSTORE_PATH`  |
| `storePassword` | `GITPULSE_ANDROID_STORE_PASSWORD` |
| `keyAlias`      | `GITPULSE_ANDROID_KEY_ALIAS`      |
| `keyPassword`   | `GITPULSE_ANDROID_KEY_PASSWORD`   |

For Actions, the owner supplies these repository secrets and variable through
their existing credential-management process:

| Input                             | Kind     | Value                                                                        |
| --------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `FLUTTER_ANDROID_KEYSTORE_BASE64` | Secret   | Base64 encoding of the existing release keystore                             |
| `FLUTTER_ANDROID_STORE_PASSWORD`  | Secret   | Keystore password                                                            |
| `FLUTTER_ANDROID_KEY_ALIAS`       | Secret   | Existing release key alias                                                   |
| `FLUTTER_ANDROID_KEY_PASSWORD`    | Secret   | Key password                                                                 |
| `FLUTTER_ANDROID_CERT_SHA256`     | Variable | Independently recorded release certificate SHA-256, hex with optional colons |

The workflow writes a temporary, permission-restricted keystore and
`android/key.properties`, then removes both even after failure. `flutter build`
does not forward the step environment into Gradle, so the release build reads
that properties file. It verifies each split APK with Android SDK `apksigner`,
rejects the Android Debug certificate, compares the signer with the pinned
certificate fingerprint, and checks the package ID, version name, ABI-specific
version code, and that the APK contains only its own ABI.
Changing the keystore alone therefore cannot silently change the update identity.

The signing key, passwords and trusted fingerprint are pending owner inputs;
this implementation does not create credentials. A missing input fails the
Android job rather than uploading an unsigned or debug-signed formal artifact.

## Build and install

Increment `flutter/pubspec.yaml`'s `version: X.Y.Z+N` for a release. `X.Y.Z` must
match `flutter-vX.Y.Z`; `N` is a positive, monotonically increasing build
number. Split APKs do not use `N` itself as `versionCode`. Flutter 3.47 adds an
ABI prefix: armeabi-v7a is `1000 + N`, arm64-v8a is `2000 + N`, and x86_64 is
`4000 + N` (`3000 + N` stayed reserved after Flutter removed x86). `N` must stay
at or below 2099996000 so the x86_64 code still fits Android's 2100000000 limit.
Never reuse or decrease `N`. Commit the
version/lockfile before tagging. The owner can run **Flutter Release** manually
on a branch for candidate artifacts or push its matching Flutter tag when ready.
Neither action is performed as part of this implementation.

The Android job waits for the shared Flutter checks, and a failed job means that
run has not delivered the formal artifacts, so the draft Release is not created.
A manual **Flutter Release** run uploads Actions artifacts only. A tag
push attaches the three ABI APKs, a Dart debug-symbol archive and their `.sha256`
files to the draft Release.
The draft body keeps the generated notes and adds a download block for those
files. Publish that draft after acceptance. Verify the checksums before
installation.

### Android

Use Android SDK platform 36, build-tools 36.0.0, NDK 28.2.13676358 and Java 25
with the committed Gradle wrapper (9.8.2), AGP 9.4.1 and Kotlin 2.4.21.
Flutter's pinned SDK supplies minSdk 24 and target/compile SDK 36. Accept the
SDK licenses on the build host. Keep `kotlin.incremental=false`; Windows Pub
cache and checkout paths on different drives otherwise break plugin compilation.

With the intended signing configuration available:

```sh
flutter build apk --release --split-per-abi --no-pub --split-debug-info=build/symbols
```

This produces three APKs and no universal APK:

- `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`
- `build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk`
- `build/app/outputs/flutter-apk/app-x86_64-release.apk`

Phones use arm64-v8a. armeabi-v7a is 32-bit ARM. x86_64 is for emulators and
x86 devices. The release script copies them to
`GitPulse-flutter-vX.Y.Z-android-<abi>.apk` with an adjacent `.apk.sha256`.
A tag push attaches those files to the draft GitHub Release. This is not an
AAB or a store upload. Use the SDK build-tools
`apksigner verify --verbose --print-certs <apk>` to compare its SHA-256 signer
against the privately recorded identity before sideloading. Allow installation
from the selected source on the test device, then use the package installer or
`adb install -r <apk>`. A device that installed an older universal APK whose
version code was `N` can update to the matching split: arm64 becomes `2000 + N`,
which is greater than `N`. Verify that the version code increased and that an
in-place update with the same certificate preserves the existing session/data.
`INSTALL_FAILED_UPDATE_INCOMPATIBLE` requires checking the installed certificate;
it is not permission to replace the release identity.

Without a release key, `flutter build apk --debug --no-pub` can check native
compilation only. Its output `app-debug.apk` is explicitly a development artifact
and is never uploaded by the release workflow.

### Dart debug symbols

Release builds split Dart debug information into `build/symbols/` without
enabling obfuscation. The workflow requires a nonempty symbols file for each
ABI and packages them as `GitPulse-flutter-vX.Y.Z-android-symbols.zip`, alongside
the verified APKs. The archive includes a `manifest.json` recording the version,
build number, source commit, workflow run/attempt, and each APK's and symbols
file's SHA-256. A missing symbols file fails the distribution job.

The existing tag workflow attaches this archive and its checksum to the draft
GitHub Release, preserving symbols beyond Actions artifact expiry. Manual runs
upload the same archive as an Actions artifact; download and retain it before
that artifact expires if the candidate APK is distributed. Keep symbols for as
long as their corresponding build may still be used. Symbols belong outside
the APK and are not installers.

To diagnose a Dart crash, download the archive from the exact build, check its
manifest against the APK checksum and extract the matching ABI's symbols:

```sh
flutter symbolize -i stack-trace.txt -d app.android-arm64.symbols
```

The other filenames are `app.android-arm.symbols` for armeabi-v7a and
`app.android-x64.symbols` for x86_64. A rebuilt APK with the same version label
can require different symbols; use the manifest's APK hash and workflow run to
identify the matching archive.

## Platform configuration audit

| Platform | Configuration and prerequisites                                                                                                                                                                                                                                                | Verification boundary                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android  | ID/namespace `ink.euphony.gitpulse`; minSdk 24; `INTERNET`; `allowBackup=false` prevents restoring encrypted credentials without their Keystore key. Default secure-storage ciphers use Android Keystore without a biometric-permission requirement.                           | Debug compilation and fail-closed release-signing checks can run without a release key; formal signature/install/update require that key and a device. |
| iOS      | Bundle ID `ink.euphony.gitpulse`; deployment target 15.0; macOS/Xcode/iOS SDK and plugin tooling. All app configurations reference `Runner.entitlements` with the prefixed Keychain group. Supply a matching team/provisioning profile and validate Keychain access on device. | **Code-level support only.** No iOS build, device, signing or runtime verification claimed.                                                            |

The Android cleartext allowance and Apple ATS/local-network declarations
allow compatible self-hosted/local development backends; they do not bypass TLS
certificate validation. Use HTTPS for real credentials. No background service,
registered OAuth callback scheme, storage/media permission, an embedded browser or
in-app asset downloader is required: browser handoff is polled after returning
to the app and assets open externally.

The selected native plugins are `flutter_secure_storage` 11.2.0 (Android Keystore,
Darwin Keychain), `url_launcher` 6.3.3, `path_provider` 2.1.6, and
Drift/SQLite 2.35.3 / 3.8.0. SQLite is bundled via native assets rather than a
separately installed database. Repository documents are drawn by
`flutter_inappwebview` 6.2.0-beta.3 in the platform browser engine — the system
WebView on Android, WKWebView on iOS — running the
renderer committed under `flutter/assets/document_viewer` (ADR 0028). Its transitive native
assets belong in the runtime bundle. Plugin platform
metadata establishes configuration compatibility, not verified operation.
`main.dart` initializes Marionette only in debug mode; release
builds use the standard Flutter binding. See the authoritative [secure-storage setup](https://pub.dev/packages/flutter_secure_storage/versions/11.2.0)
and the [Flutter Android release guide](https://docs.flutter.dev/deployment/android).

## Owner-run Android acceptance

Use a non-production compatible Nitro instance and test accounts. Prepare both a
personal-mode instance and an instance enabling PAT/OAuth; personal mode takes
precedence, so all three methods cannot be tested on one personal-mode session.
Use two controlled repositories with known release IDs/publication times,
multiple pages, release bodies/assets and a deliberately introduced history gap.
Do not create production releases, credentials or follow changes as test data.
Automated suites use deterministic clocks, isolated SQLite and loopback HTTP
fixtures (`tests/fixtures/native-login-server.ts` and `release-timeline-server.ts`).

Record device, app version/build, backend version/base
path, configured providers, previous installed version/certificate, fixture IDs,
expected result, actual result and any failure evidence. Never record tokens,
passwords or session cookies. Run every row on the Android device:

| Case                                | Action and expected result                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First connection and custom backend | Launch a fresh install; the default address connects automatically. Edit a test server with a base path, connect successfully and restart; the saved address reconnects. Capability failure offers retry/address editing and preserves the last successful address. Merely opening the editor keeps the current session.                                |
| Personal password                   | On a personal-mode test instance, unlock using the test password. Only usable providers appear. Restart and verify secure session restoration without password entry. Wrong password does not establish a session.                                                                                                                                      |
| PAT                                 | On a PAT-enabled non-personal instance, sign in using a test PAT. Restart and verify the session restores without persisting the PAT. Switch accounts and verify the previous identity's releases disappear.                                                                                                                                            |
| GitHub OAuth                        | Start sign-in, compare the browser/app approval code, approve in the system browser, return to the app and complete the same attempt. Check cancel/expiry and retry. The app restores its own session after restart; browser cookies are not an app session.                                                                                            |
| Follow sharing                      | Follow both controlled repositories; verify the same follows in the web client/second installation after reload. Unfollow one; its local cards/cache disappear. Follow it again; fetching starts from page one.                                                                                                                                         |
| Timeline and details                | Scroll a long date-grouped timeline, open/close details, browse its Repository Release List and return to the Entry Release. Confirm scroll position survives. Exercise Android Back, the release sheet's resize handle, repository overview/README, relative links, SVG, wide tables, details/summary, code selection/copy and external asset links.   |
| Offline restart                     | Fetch and expose known releases, record the saved update time, quit, disable the device network and restart. The Saved Visible Timeline/bodies restore with offline state/time. Unfetched README/images are not promised offline. Network failure preserves credentials/cache; a rejected session hides cached data until reauthentication.             |
| Gap reconnection                    | Retain A:8/7/6 and B's old segment. Return fresh A:12/11/10 without the intervening page; old records stay hidden. Restart/refetch the latest segment; they remain hidden. Explicitly load A:9/8; B still blocks the shared extension until its own connection succeeds. Test B failure/retry and unavailable-versus-transient status.                  |
| Synchronized retention and baseline | Start with 30 days; change to 1, then 90, and synchronize the second installation/web. Shortening prunes old durable data; expanding requires refetch. Verify UTC publication cutoff, time-zone independence, and older online-only results disappearing on restart. A usable refresh updates the shared baseline; pagination/retry/clear-cache do not. |
| Clear/logout/identity               | Clear cache; login, Release Follows, retention and baseline remain. Restart offline; cleared history stays absent. Logout removes the local session/history. Backend/account changes invalidate in-flight results; the former identity never reappears. Theme/language remain device preferences.                                                       |
| Install/update                      | Install the signed Android APK whose ABI matches the device. Upgrade from the previous formal version without deleting user storage. Verify stable ID/certificate, increasing version code, secure login restore, cached history and preferences. Separately document migration from any debug install.                                                 |

The existing automated coverage is mapped below so missing feature regressions
are fixed in their owning slice rather than deferred to device acceptance:

| Public behavior                                                    | Existing Flutter suites (`flutter/test/`)                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection/providers/session/real Nitro handoff                    | `connection_flow_test.dart`, `session_flow_test.dart`, `native_login_http_test.dart`, `session/lifetime_cookie_jar_test.dart`                                     |
| Per-repository reconnection/shared gating/pagination/partial retry | `timeline/timeline_connection_test.dart`, `timeline/timeline_pagination_test.dart`, `timeline/timeline_recovery_test.dart`, `timeline/timeline_session_test.dart` |
| Durable recovery/retention/clearing/races/baseline/identity        | `timeline/timeline_cache_test.dart`, `settings/timeline_settings_test.dart`, `release_timeline_http_test.dart`, `follows/release_follows_session_test.dart`       |
| Navigation/details/scroll/content/settings                         | `timeline/timeline_screen_test.dart`, `timeline/timeline_toolbar_test.dart`, `releases/release_drawer_test.dart`, `repositories/`, `releases/`, `presentation/`   |

## Recorded verification and pending inputs

Automated/build results for this change are recorded here after execution. A
successful compile or headless test is not an owner device acceptance result.

- Android signing guards: `:app:preReleaseBuild` without signing inputs failed
  explicitly at `validateReleaseSigning`; a separate invocation with controlled
  placeholder properties rejected the `androiddebugkey` alias as intended.
- Android: `flutter build apk --debug --no-pub` passed. SDK `aapt2` reported
  `ink.euphony.gitpulse`, version `0.1.0` / code `1`, minSdk 24 and target SDK 36;
  `apksigner` confirmed the Android Debug certificate, so this remains explicitly
  a development build and is not a formal release artifact.
- Flutter: after the desktop platform folders were removed,
  `flutter pub get --enforce-lockfile` resolved the committed graph,
  `dart format --output=none --set-exit-if-changed lib test` and
  `flutter analyze --no-pub` reported nothing, and the full
  `flutter test --no-pub` suite passed (494 tests).
- Repository: `bun run fmt:check`, `bun run lint` (0 warnings, 0 errors),
  `bunx nuxi typecheck` and `bun test --parallel` passed (983 tests across 121
  files), including the release-artifact contracts, which now require exactly the
  three split APKs and their checksums.
- Two-axis code review of this change: Standards found one documented-standard
  breach — ADR 0015, 0017 and 0028 and the published issue copy were not
  surfaced as partly superseded — and one tokens-first breach, a bare 12dp
  between stacked cards; both are fixed here, together with the Follows header
  column left behind by the removed sidebar and the discovery list's restored
  width. Spec found no missing desktop removal and no wrong behaviour.
- Formal Android signed APK/certificate/install/update: pending existing owner
  signing key, secrets and trusted certificate fingerprint.
- Android device acceptance: pending owner execution with controlled test
  accounts/backends/data and previous formal artifacts. No Android device is
  connected to this workstation.
- iOS: configuration audited only; platform host, credential-store setup, Apple
  team/provisioning and runtime verification remain pending.

Issue #112 implements this distribution slice; parent #95 retains its existing
title, body, labels and state and is not closed automatically.
