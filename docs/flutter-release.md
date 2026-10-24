# Flutter distribution and acceptance

GitPulse's native client lives in `flutter/`, uses application identity
`ink.euphony.gitpulse`, and has its own `flutter-vX.Y.Z` tags. Its release workflow
prepares a Windows x64 runtime ZIP and a signed universal Android APK. Pushing
the matching `flutter-vX.Y.Z` tag creates a draft GitHub Release titled
`GitPulse Flutter vX.Y.Z` and attaches those files. It does not deploy Nitro or
publish the extension. Main app `vX.Y.Z` and extension `extension-vX.Y.Z`
workflows retain their separate triggers.

## Reproducible toolchain

Run Flutter commands from `flutter/`. The exact stable Flutter SDK is recorded in
`pubspec.yaml` under `environment.flutter`; CI reads that value. Use the bundled
Dart SDK and commit `pubspec.lock`. Flutter does not participate in the Bun
workspace or Nuxt discovery. The root web checks still run independently.

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
absolute keystore path with forward slashes on Windows. Keep the key outside the
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
that properties file. It verifies the actual APK with Android SDK `apksigner`,
rejects the Android Debug certificate, compares the signer with the pinned
certificate fingerprint, and checks the package ID, version name and version
code before uploading an APK.
Changing the keystore alone therefore cannot silently change the update identity.

The signing key, passwords and trusted fingerprint are pending owner inputs;
this implementation does not create credentials. A missing input fails the
Android job rather than uploading an unsigned or debug-signed formal artifact.

## Build and install

Increment `flutter/pubspec.yaml`'s `version: X.Y.Z+N` for a release. `X.Y.Z` must
match `flutter-vX.Y.Z`; `N` is a positive, monotonically increasing Android
`versionCode` (at most 2100000000). Never reuse or decrease an installed version
code. The same pubspec supplies the Windows executable version. Commit the
version/lockfile before tagging. The owner can run **Flutter Release** manually
on a branch for candidate artifacts or push its matching Flutter tag when ready.
Neither action is performed as part of this implementation.

Both platform jobs wait for the shared Flutter checks. Windows can finish even
if signing inputs are unavailable for Android; a failed Android job means that
run has not delivered both formal artifacts, and the draft Release is not
created. A manual **Flutter Release** run uploads Actions artifacts only. A tag
push attaches the ZIP, APK, and `.sha256` files to the draft Release. Publish
that draft after acceptance. Verify the checksums before installation.

### Windows x64

Use Visual Studio 2022 or 2026 Build Tools with **Desktop development with C++**, the
Windows SDK, MSVC x64/x86 tools, CMake, and **C++ ATL** (required by secure storage).
CI uses `windows-2025`. `flutter doctor -v` should recognize the toolchain.

```powershell
cd flutter
flutter pub get --enforce-lockfile
flutter build windows --release --no-pub
./tool/package_windows.ps1
```

The packager requires a release AOT image, Flutter data/assets, plugin DLLs, the
MSVC runtime DLLs and an executable matching the pubspec version. CMake installs
the redistributable runtime beside the executable. The ZIP contains **every
file in `build/windows/x64/runner/Release/`**, including SQLite and other native
assets; distributing only `gitpulse.exe` is insufficient. Outputs:

- `build/distributions/GitPulse-flutter-vX.Y.Z-windows-x64.zip`
- The adjacent `.zip.sha256` checksum.

Extract the ZIP to a writable local application folder and run `gitpulse.exe`.
For an update, close the app and extract the new complete ZIP into a **new**
folder; do not mix old and new DLLs. The account credentials and local data are
in the user's OS storage, not the ZIP. Preserve the product identity and test
that an update from the previous formal version retains session/settings/cache.

### Android

Use Android SDK platform 36, build-tools 36.0.0, NDK 28.2.13676358 and Java 25
with the committed Gradle wrapper (9.8.1), AGP 9.1.0 and Kotlin 2.4.21.
Flutter's pinned SDK supplies minSdk 24 and target/compile SDK 36. Accept the
SDK licenses on the build host. Keep `kotlin.incremental=false`; Windows Pub
cache and checkout paths on different drives otherwise break plugin compilation.

With the intended signing configuration available:

```sh
flutter build apk --release --no-pub
```

The local APK is `build/app/outputs/flutter-apk/app-release.apk`. The Actions
artifact is `GitPulse-flutter-vX.Y.Z-android.apk` with an adjacent `.apk.sha256`.
A tag push attaches the same files to the draft GitHub Release. It is a
universal APK, not an AAB or a store upload. Use the SDK build-tools
`apksigner verify --verbose --print-certs <apk>` to compare its SHA-256 signer
against the privately recorded identity before sideloading. Allow installation
from the selected source on the test device, then use the package installer or
`adb install -r <apk>`. Verify that the version code increased and that an
in-place update with the same certificate preserves the existing session/data.
`INSTALL_FAILED_UPDATE_INCOMPATIBLE` requires checking the installed certificate;
it is not permission to replace the release identity.

Without a release key, `flutter build apk --debug --no-pub` can check native
compilation only. Its output `app-debug.apk` is explicitly a development artifact
and is never uploaded by the release workflow.

## Five-platform configuration audit

| Platform | Configuration and prerequisites                                                                                                                                                                                                                                                                                                                                          | Verification boundary                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows  | `windows/CMakeLists.txt` bundles the complete runtime and MSVC DLLs; secure storage uses encrypted support files plus Windows Credential Manager. Keep the Windows user profile and Credential Manager available. ATL is a build prerequisite.                                                                                                                           | Windows x64 build/ZIP checks; actual credential-store and update behavior require the owner checklist below.                                           |
| Android  | ID/namespace `ink.euphony.gitpulse`; minSdk 24; `INTERNET`; `allowBackup=false` prevents restoring encrypted credentials without their Keystore key. Default secure-storage ciphers use Android Keystore without a biometric-permission requirement.                                                                                                                     | Debug compilation and fail-closed release-signing checks can run without a release key; formal signature/install/update require that key and a device. |
| Linux    | GTK application ID `ink.euphony.gitpulse`; GTK 3, Clang, CMake, Ninja, pkg-config and GTK development headers. Install `libsecret-1-dev` to build, `libsecret-1-0` to run, plus an unlocked Secret Service provider on the user's D-Bus session (for example GNOME Keyring or compatible KWallet). A headless shell without that service cannot establish durable login. | **Code-level support only.** No Linux build, keyring or runtime verification claimed.                                                                  |
| macOS    | Bundle ID `ink.euphony.gitpulse`; deployment target 12.0; Xcode/macOS SDK and plugin tooling. Both DebugProfile and Release entitlements enable sandbox/network client and the prefixed Keychain group; debug additionally permits JIT/network server. A signing team and provisioning matching `$(AppIdentifierPrefix)ink.euphony.gitpulse` must be configured.         | **Code-level support only.** No Mac, Keychain, signing, notarization or runtime verification claimed.                                                  |
| iOS      | Bundle ID `ink.euphony.gitpulse`; deployment target 15.0; macOS/Xcode/iOS SDK and plugin tooling. All app configurations reference `Runner.entitlements` with the prefixed Keychain group. Supply a matching team/provisioning profile and validate Keychain access on device.                                                                                           | **Code-level support only.** No iOS build, device, signing or runtime verification claimed.                                                            |

The existing Android cleartext allowance and Apple ATS/local-network declarations
allow compatible self-hosted/local development backends; they do not bypass TLS
certificate validation. Use HTTPS for real credentials. No background service,
registered OAuth callback scheme, storage/media permission, embedded WebView or
in-app asset downloader is required: browser handoff is polled after returning
to the app and assets open externally.

The selected native plugins are `flutter_secure_storage` 11.2.0 (Windows 4.2.2,
Linux 3.0.3, Darwin 0.4.3), `url_launcher` 6.3.3, `path_provider` 2.1.6, and
Drift/SQLite 2.35.2 / 3.7.1. SQLite is bundled via native assets rather than a
separately installed database. `shiki_flutter` 1.1.0 uses its default Dart engine;
its transitive native assets still belong in the runtime bundle. Plugin platform
metadata establishes configuration compatibility, not verified operation on all
five platforms. `main.dart` initializes Marionette only in debug mode; release
builds use the standard Flutter binding. See the authoritative [secure-storage setup](https://pub.dev/packages/flutter_secure_storage/versions/11.2.0),
[Windows plugin prerequisites](https://pub.dev/packages/flutter_secure_storage_windows/versions/4.2.2),
[Flutter Android release guide](https://docs.flutter.dev/deployment/android), and
[Flutter Windows release guide](https://docs.flutter.dev/deployment/windows).

## Owner-run Windows and Android acceptance

Use a non-production compatible Nitro instance and test accounts. Prepare both a
personal-mode instance and an instance enabling PAT/OAuth; personal mode takes
precedence, so all three methods cannot be tested on one personal-mode session.
Use two controlled repositories with known release IDs/publication times,
multiple pages, release bodies/assets and a deliberately introduced history gap.
Do not create production releases, credentials or follow changes as test data.
Automated suites use deterministic clocks, isolated SQLite and loopback HTTP
fixtures (`tests/fixtures/native-login-server.ts` and `release-timeline-server.ts`).

For each platform, record OS/device, app version/build, backend version/base
path, configured providers, previous installed version/certificate, fixture IDs,
expected result, actual result and any failure evidence. Never record tokens,
passwords or session cookies. Run every row on both Windows and Android:

| Case                                | Action and expected result                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First connection and custom backend | Launch a fresh install; the default address connects automatically. Edit a test server with a base path, connect successfully and restart; the saved address reconnects. Capability failure offers retry/address editing and preserves the last successful address. Merely opening the editor keeps the current session.                                    |
| Personal password                   | On a personal-mode test instance, unlock using the test password. Only usable providers appear. Restart and verify secure session restoration without password entry. Wrong password does not establish a session.                                                                                                                                          |
| PAT                                 | On a PAT-enabled non-personal instance, sign in using a test PAT. Restart and verify the session restores without persisting the PAT. Switch accounts and verify the previous identity's releases disappear.                                                                                                                                                |
| GitHub OAuth                        | Start sign-in, compare the browser/app approval code, approve in the system browser, return to the app and complete the same attempt. Check cancel/expiry and retry. The app restores its own session after restart; browser cookies are not an app session.                                                                                                |
| Follow sharing                      | Follow both controlled repositories; verify the same follows in the web client/second installation after reload. Unfollow one; its local cards/cache disappear. Follow it again; fetching starts from page one.                                                                                                                                             |
| Timeline and details                | Scroll a long date-grouped timeline, open/close details, browse its Repository Release List and return to the Entry Release. Confirm scroll position survives. Exercise desktop Escape/Android Back, narrow sheet/wide drawer, repository overview/README, relative links, SVG, wide tables, details/summary, code selection/copy and external asset links. |
| Offline restart                     | Fetch and expose known releases, record the saved update time, quit, disable the device network and restart. The Saved Visible Timeline/bodies restore with offline state/time. Unfetched README/images are not promised offline. Network failure preserves credentials/cache; a rejected session hides cached data until reauthentication.                 |
| Gap reconnection                    | Retain A:8/7/6 and B's old segment. Return fresh A:12/11/10 without the intervening page; old records stay hidden. Restart/refetch the latest segment; they remain hidden. Explicitly load A:9/8; B still blocks the shared extension until its own connection succeeds. Test B failure/retry and unavailable-versus-transient status.                      |
| Synchronized retention and baseline | Start with 30 days; change to 1, then 90, and synchronize the second installation/web. Shortening prunes old durable data; expanding requires refetch. Verify UTC publication cutoff, time-zone independence, and older online-only results disappearing on restart. A usable refresh updates the shared baseline; pagination/retry/clear-cache do not.     |
| Clear/logout/identity               | Clear cache; login, Release Follows, retention and baseline remain. Restart offline; cleared history stays absent. Logout removes the local session/history. Backend/account changes invalidate in-flight results; the former identity never reappears. Theme/language remain device preferences.                                                           |
| Install/update                      | Install the extracted complete Windows ZIP or formally signed Android APK. Upgrade from the previous formal version without deleting user storage. Verify stable ID/certificate, increasing version code, secure login restore, cached history and preferences. Separately document migration from any debug install.                                       |

The existing automated coverage is mapped below so missing feature regressions
are fixed in their owning slice rather than deferred to device acceptance:

| Public behavior                                                    | Existing Flutter suites (`flutter/test/`)                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection/providers/session/real Nitro handoff                    | `connection_flow_test.dart`, `session_flow_test.dart`, `native_login_http_test.dart`, `session/lifetime_cookie_jar_test.dart`                                     |
| Per-repository reconnection/shared gating/pagination/partial retry | `timeline/timeline_connection_test.dart`, `timeline/timeline_pagination_test.dart`, `timeline/timeline_recovery_test.dart`, `timeline/timeline_session_test.dart` |
| Durable recovery/retention/clearing/races/baseline/identity        | `timeline/timeline_cache_test.dart`, `settings/timeline_settings_test.dart`, `release_timeline_http_test.dart`, `follows/release_follows_session_test.dart`       |
| Adaptive navigation/details/scroll/content/settings                | `timeline/timeline_screen_test.dart`, `timeline/timeline_toolbar_test.dart`, `releases/release_drawer_test.dart`, `repositories/`, `releases/`, `presentation/`   |

## Recorded verification and pending inputs

Automated/build results for this change are recorded here after execution. A
successful compile or headless test is not an owner device acceptance result.

- Windows: `flutter build windows --release --no-pub` passed on Windows 11 with
  Visual Studio Build Tools 2022. `tool/package_windows.ps1` produced the ZIP and
  checksum; its archive file list matches all 26 files in the complete runtime
  directory, including the MSVC runtime and SQLite DLLs. No app launch claimed.
- Android signing guards: `:app:preReleaseBuild` without signing inputs failed
  explicitly at `validateReleaseSigning`; a separate invocation with controlled
  placeholder properties rejected the `androiddebugkey` alias as intended.
- Android: `flutter build apk --debug --no-pub` passed. SDK `aapt2` reported
  `ink.euphony.gitpulse`, version `0.1.0` / code `1`, minSdk 24 and target SDK 36;
  `apksigner` confirmed the Android Debug certificate, so this remains explicitly
  a development build and is not a formal release artifact.
- Flutter: analysis and formatting passed; 17 focused HTTP/reconnection/settings
  tests passed, followed by all 233 tests in the final full suite. Enforced
  lockfile resolution and code generation also passed; generated source did not
  change after the compatible dependency updates.
- Repository: `bun test` passed (945 tests); extension tests passed separately
  (16 tests). Root formatting/lint, Nuxt typecheck, extension typecheck and
  `actionlint` for both new workflows passed. The web production build was not
  run locally.
- Two-axis code review: no Standards findings and no Spec findings.
- Formal Android signed APK/certificate/install/update: pending existing owner
  signing key, secrets and trusted certificate fingerprint.
- Windows credential-store/install/update and Android device acceptance: pending
  owner execution with controlled test accounts/backends/data and previous formal
  artifacts. No Android device is connected to this workstation.
- Linux/macOS/iOS: configuration audited only; platform hosts, credential-store
  setup, Apple team/provisioning and runtime verification remain pending.

Issue #112 implements this distribution slice; parent #95 retains its existing
title, body, labels and state and is not closed automatically.
