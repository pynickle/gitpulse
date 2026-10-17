# GitPulse native client

The focused Release Timeline client lives in this independent Flutter package.
Application identity: **GitPulse**, `ink.euphony.gitpulse`. Client releases use
`flutter-vX.Y.Z` tags, independently of the main app and browser extension.

This first slice implements backend connection and provider discovery. Timeline,
Follows, and Settings establish the navigation shell; authentication and release
data are implemented in later slices. Available sign-in methods describe the
server's providers, not implemented client login buttons.

## Development

Use the stable Flutter **3.47.7** SDK (Dart **3.13.5**) or a compatible later stable
SDK. The SDK's stable branch matched that release when checked on 2026-10-17.
Run from `flutter/`:

```sh
flutter pub get
dart run build_runner build
flutter gen-l10n
flutter analyze
flutter test
dart format --output=none --set-exit-if-changed lib test
flutter run -d windows
# Or choose an attached Android device from flutter devices.
```

`flutter pub get` generates SDK localization sources; `build_runner` regenerates
committed DTO mappings. Run `flutter doctor -v` to check the host toolchain. Root
Nuxt commands and extension commands remain independent; root formatting/lint
and Nuxt discovery exclude this directory.

Dependencies use the newest jointly compatible stable versions resolved on
2026-10-17, with a committed application lockfile and no overrides. `flutter pub
outdated` reports all direct runtime dependencies current. `build_runner 2.16.2`
is the newest resolvable generator runner: 2.17.0 requires `build ^4.1.0` and
`build_config ^1.4.0`, whereas the selected generators resolve to `build 4.0.11`
and `build_config 1.3.3`; 2.17.1 requires `build >=5.0.0 <5.1.0`.

Riverpod declarations and presentation state are handwritten. DTO mapping uses
json_serializable. Dio owns typed backend discovery; GoRouter owns routing; SDK
ARB localization supports English and Simplified Chinese with the system locale.
The Material 3 shell follows the system theme and switches between a navigation
rail and bottom navigation with available width. Drift/SQLite, secure storage,
cookie handling, document rendering, and the default pure-Dart Shiki engine are
resolved for the agreed later slices. No cache, session persistence, Markdown
renderer, or OAuth handoff is claimed by this shell.

## Backend connection contract

The initial address is empty. HTTP(S) backend URLs may include a deployment base
path; embedded credentials, queries, and fragments are rejected. For example,
`https://example.org/gitpulse/` probes
`https://example.org/gitpulse/api/native/capabilities`. Redirects are not followed;
enter the backend's final deployed address. HTTP transport is enabled for local
and self-hosted instances; use HTTPS on untrusted networks. Certificate validation
is unchanged.

The public, unauthenticated `GET /api/native/capabilities` returns:

```json
{
  "protocolVersion": 1,
  "capabilities": ["provider-discovery"],
  "providers": {
    "personalMode": true,
    "patEnabled": false,
    "oauthEnabled": false,
    "mode": "personal"
  }
}
```

Version 1 requires the `provider-discovery` capability and a normalized provider
combination. Missing/older/malformed contracts request a server update; a newer
protocol requests a client update. Connectivity errors are retryable and do not
replace the last successful backend. The address is saved through the platform
credential store only after successful discovery. A saved address is prefilled
on restart and must be checked again. Storage errors are shown without silently
claiming persistence.

`resolveAuthProviderState()` remains the only server provider authority. Personal
mode takes precedence over PAT and OAuth. The existing web provider endpoint keeps
its response shape and reflects the same precedence. Later slices must add
capabilities only with working implementations and contract tests; native login
handoff and account-synchronized retention are deliberately absent today. A
future client that requires those features must require their capabilities.

## Native prerequisites and verification

All five platform runners were generated with the stable SDK. Automated widget
tests and analysis on Windows do **not** verify native builds, plugin integration,
credential stores, device networking, or packaging. No platform runtime has been
validated as part of this change. Windows and Android are the owner's planned
manual-debug targets; Linux/macOS/iOS remain scaffolding and configuration only.

| Target | Native setup |
| --- | --- |
| Windows | Visual Studio with Desktop development with C++, Windows SDK, CMake, and the C++ ATL component required by flutter_secure_storage. Build/run on Windows. A future ZIP must contain the complete release directory, including DLLs and data. |
| Android | Android Studio/SDK, Java 17, the SDK/NDK versions selected by Flutter, and licenses accepted through `flutter doctor --android-licenses`. Minimum API 23. Internet permission is in the main manifest; cleartext supports entered HTTP backends. Auto backup is disabled for platform secure storage. The emulator reaches the host through `10.0.2.2`, not its own localhost. |
| Linux | Build on Linux with Clang, CMake, Ninja, pkg-config, GTK 3 development packages, and libsecret development/runtime packages. A running D-Bus Secret Service (such as GNOME Keyring or KWallet) is needed to remember the address. On Debian/Ubuntu install `libsecret-1-dev` alongside Flutter's Linux prerequisites. |
| macOS | Build on macOS with Xcode and its command-line tools; install CocoaPods if requested by the Flutter/plugin tooling. Debug/Profile and Release entitlements include outbound networking and the app's Keychain access group. Configure an Apple development team and provisioning for Keychain Sharing; inspect the signed entitlements before distribution. |
| iOS | Build on macOS with Xcode, signing/provisioning, and CocoaPods if requested. The runner's Debug/Profile/Release configurations reference `Runner.entitlements` for the app's Keychain access group. The SDK template targets iOS 15. Local-network usage text and HTTP transport settings support entered self-hosted addresses. |

Apple transport settings allow user-selected HTTP instances. Local-network access
can prompt the user; denied access appears as a connection failure. Do not assume
plugin platform badges constitute runtime testing.

The Android template currently uses a **debug** key for local release builds. It
is not a distribution signing configuration. Before distributing an APK, configure
a stable private release key outside version control as part of the release slice.
No signing credentials, release workflows, or platform callback handlers are
introduced here.

Native setup references: [Flutter platform setup](https://docs.flutter.dev/platform-integration),
[secure storage setup](https://pub.dev/packages/flutter_secure_storage),
[Drift platform guidance](https://drift.simonbinder.eu/platforms/), and
[Android release signing](https://docs.flutter.dev/deployment/android).
