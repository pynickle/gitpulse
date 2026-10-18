# GitPulse native client

The focused Release Timeline client lives in this independent Flutter package.
Application identity: **GitPulse**, `ink.euphony.gitpulse`. Client releases use
`flutter-vX.Y.Z` tags, independently of the main app and browser extension.

This client connects to a GitPulse backend, discovers its sign-in methods, and
signs in with the server's personal password, PAT, or GitHub through the system
browser. Timeline, Follows, and Settings establish the navigation shell. Release
data is implemented in later slices.

## Development

Use the stable Flutter **3.47.7** SDK (Dart **3.13.5**) or a compatible later stable
SDK. The SDK's stable branch matched that release when checked on 2026-10-17.
Run from `flutter/`:

```sh
flutter pub get
dart run build_runner build
flutter gen-l10n
flutter analyze
flutter test # Also needs Bun for the local Nitro handoff contract test.
dart format --output=none --set-exit-if-changed lib test
flutter run -d windows
# Or choose an attached Android device from flutter devices.
```

`flutter pub get` generates SDK localization sources; `build_runner` regenerates
committed DTO mappings. Run `flutter doctor -v` to check the host toolchain. Root
Nuxt commands and extension commands remain independent; root formatting/lint
and Nuxt discovery exclude this directory.

Android Kotlin incremental compilation is disabled in `android/gradle.properties`
because a Windows Pub cache and checkout on different drives can fail with
`this and base files have different roots` / `Could not close incremental caches`.
This trades incremental Kotlin compilation speed for reliable cross-drive builds;
Gradle can still skip unchanged tasks. See the
[Kotlin cache documentation](https://kotlinlang.org/docs/gradle-compilation-and-caches.html).

Dependencies use the newest jointly compatible stable versions resolved on
2026-10-17, with a committed application lockfile and no overrides. `flutter pub
outdated` reports all direct runtime dependencies current. `build_runner 2.16.2`
is the newest resolvable generator runner: 2.17.0 requires `build ^4.1.0` and
`build_config ^1.4.0`, whereas the selected generators resolve to `build 4.0.11`
and `build_config 1.3.3`; 2.17.1 requires `build >=5.0.0 <5.1.0`.

Riverpod declarations and presentation state are handwritten. DTO mapping uses
json_serializable. Dio owns backend discovery and the cookie session; GoRouter
owns routing; SDK ARB localization supports English and Simplified Chinese with
the system locale. The Material 3 shell follows the system theme and switches
between a navigation rail and bottom navigation with available width.
Drift/SQLite, document rendering, and the default pure-Dart Shiki engine are
resolved for later slices. Release caching and Markdown rendering remain later work.

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
its response shape and reflects the same precedence. OAuth sign-in also requires
`native-login-handoff`. The app hides OAuth when that capability is absent;
an OAuth-only server without it requests a server update. Personal password and
PAT remain usable independently. Account-synchronized retention is a later slice.

## Sign-in and session

On an OAuth-enabled server with `native-login-handoff`, choose **Continue with
GitHub**. Check that the code in the system browser matches the app, sign in with
GitHub, explicitly approve the app, and switch back to GitPulse. The app resumes
polling and exchanges the single-use approval for its own server Cookie session.
The browser's Cookie jar is never copied. All five platforms use the same
external-browser flow without registering callback links or a background service.

Pending attempts stop polling while the app is inactive/hidden and resume on
foreground return. They expire after ten minutes and can be cancelled; starting
another attempt or clearing the identity invalidates old responses. Temporary
network failures leave the previous account and cached data alone. Pending proof
is held only in memory: if the app process exits, start sign-in again; a completed
session persists securely as described below. Browser launch, cancellation, and
expiry messages support English and Simplified Chinese.

See [the server handoff contract](../docs/native-login-handoff.md) for deployment
and protocol details. The automated suite uses actual local HTTP handlers with
isolated storage and separate browser/app jars; only external GitHub success is
simulated. No production browser automation or native browser/plugin runtime
verification is claimed.

Password and PAT forms are shown only for providers the connected server enables.
Personal mode shows the password form and not a PAT form. A rejected password or
token is reported as invalid credentials; the message does not offer a provider
the server has not enabled. OAuth-only servers show that GitHub OAuth is the
available method. The browser handoff that completes OAuth is a later slice.

Sign-in calls the existing `/auth/unlock` and `/auth/pat` routes. Those routes,
and later mutating `/api/` calls, send the `gitpulse_csrf` cookie back in the
`x-csrf-token` header. The client does not send an `Authorization` bearer token
and does not write the password or PAT to disk. `remember` is false: the app
does not ask the server for a second device-remember credential.

The opaque `nuxt-session` cookie is the session. Dio's cookie manager stores it
through `flutter_secure_storage`, including a personal-mode cookie that has no
`Max-Age`, because the sealed session stays valid until logout or rejection.
Cookies with `Expires` or `Max-Age` are dropped at that time, including `Secure`
cookies on HTTPS. When both lifetime attributes are present, `Max-Age` takes
precedence. After backend discovery succeeds, restarting the app sends the stored
cookie to
`GET /api/_auth/session` and restores the same account without asking for the
password or PAT again.

Explicit sign-out and a backend change emit an identity-clearing transition and
cancel in-flight requests before the local cookie and public identity are
removed. A later 401 hides signed-in content and keeps that identity so the same
account can sign in again; a different login clears the previous identity first.
Choosing a different account clears the current identity before the new sign-in
form is enabled. Sign-out and backend/account switching keep sign-in disabled
until cookie cleanup finishes. Storage failures are shown, and cleanup can be
retried with Sign out or Change backend; a backend change waits for successful
local cleanup. A rejected session cancels pending work and pauses further API
requests until sign-in succeeds. Network loss, HTTP 429, a repository 403, and a
server error during session restoration leave the signed-in identity in place.

The public identity (login, name, avatar URL, backend) is stored beside the
cookie so a failed session probe after discovery is not treated as sign-out. It
is not a credential. Startup still requires successful capability discovery;
entering the app after a fully offline restart is deferred to the offline-cache
slice.

## Native prerequisites and verification

All five platform runners were generated with the stable SDK. Automated widget
tests and analysis on Windows do **not** verify native builds, plugin integration,
credential stores, device networking, or packaging. Android debug APK compilation,
installation, and process startup were smoke-tested on a V2548A running Android 17
(API 37) on 2026-10-18. Live backend sign-in and native credential persistence
were not verified by that startup check. Windows and Android remain the owner's
manual-debug targets; Linux/macOS/iOS remain scaffolding and configuration only.

| Target | Native setup |
| --- | --- |
| Windows | Visual Studio with Desktop development with C++, Windows SDK, CMake, and the C++ ATL headers the secure-storage plugin still compiles (`atlstr.h`). The default runtime store is the plugin's DPAPI file `flutter_secure_storage.dat` in the app support directory, not the legacy Credential Manager blobs. Leave `WindowsOptions.useBackwardCompatibility` unset so session cookies are not forced through that size-limited store. Build/run on Windows. A future ZIP must contain the complete release directory, including DLLs and data. |
| Android | Android Studio/SDK, Java 17, the SDK/NDK versions selected by Flutter, and licenses accepted through `flutter doctor --android-licenses`. Minimum API 23, which the default `AndroidOptions` need for AES-GCM data and RSA-OAEP key wrapping. No biometric prompt is configured. Internet permission is in the main manifest; cleartext supports entered HTTP backends. `android:allowBackup="false"` keeps the encrypted session material out of Android backup. The emulator reaches the host through `10.0.2.2`, not its own localhost. |
| Linux | Build on Linux with Clang, CMake, Ninja, pkg-config, GTK 3 development packages, and libsecret development/runtime packages. A running D-Bus Secret Service (such as GNOME Keyring or KWallet) is required before the address or session cookie can be stored. On Debian/Ubuntu install `libsecret-1-dev` and `libsecret-1-0` alongside Flutter's Linux prerequisites. This has not been run here. |
| macOS | Build on macOS with Xcode and its command-line tools; install CocoaPods if requested by the Flutter/plugin tooling. Debug/Profile and Release entitlements include outbound networking and the Keychain access group `$(AppIdentifierPrefix)ink.euphony.gitpulse`. Configure an Apple development team and provisioning for Keychain Sharing before the session cookie can be written; inspect the signed entitlements before distribution. This has not been run here. |
| iOS | Build on macOS with Xcode, signing/provisioning, and CocoaPods if requested. The runner's Debug/Profile/Release configurations reference `Runner.entitlements` for the same Keychain access group. No extra Keychain usage string is required. The SDK template targets iOS 15. Local-network usage text and HTTP transport settings support entered self-hosted addresses. This has not been run here. |

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
