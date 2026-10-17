# Flutter native authentication options

Investigated on 2026-10-17. The user subsequently selected the existing Cookie-session contract with an app-bound browser/poll handoff, and explicitly selected the shared account refresh baseline. The alternatives below remain useful context rather than pending equivalent choices. No production instance was accessed and no server was started.

## Existing session contract

- `server/api/auth/providers.get.ts` exposes provider availability. In personal mode, UI must prioritize the mode rather than independently displaying every true availability flag: the PAT route rejects PAT login in personal mode.
- `server/routes/auth/pat.post.ts` and `server/routes/auth/unlock.post.ts` establish sessions through `establishGitHubSession()`. A native client can retain the resulting server session without retaining the PAT or personal password.
- `server/utils/github-auth-utils.ts` reads the GitHub token from the secure Nuxt session. There is no existing GitPulse Bearer-session path.
- The current OAuth route establishes a browser session and redirects to a same-origin return route. `shared/utils/auth-return-route.ts` rejects absolute URLs, custom schemes, and auth/API return paths. Do not weaken this browser contract into an unrestricted native callback.
- App HTTP storage and the system browser do not share cookies. A successful browser OAuth flow alone does not log in the app's HTTP client.

Native OAuth guidance favors an external browser and appropriate PKCE protection; an installed application's embedded shared secret cannot be treated as confidential. See [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html).

## Three independent choices

1. **GitPulse session credential:** keep Cookie sessions, or introduce a separate Bearer session lifecycle. Bearer requires centralized issuance, reads, expiry/refresh/revocation, and broader integration; it is not just a client header change.
2. **Browser-to-app handoff:** an app-instance-bound short-lived transaction consumed by callback or by bounded polling. Bind it to the initiating client through a verifier/challenge, backend origin, expiry, single consumption, and atomic completion. This does not authenticate an official app binary or device hardware.
3. **GitHub upstream authorization:** retain the existing authorization-code callback, or additionally support GitHub Device Flow. Device Flow requires operator enablement and its own interval/slow-down/cancellation/expiry behavior; it is not the same as polling a GitPulse handoff transaction.

Keeping Cookie sessions plus an app-bound handoff would preserve the current server session authority. During app redemption, call `establishGitHubSession()` rather than writing session shape independently. Mutating APIs retain CSRF protection; auth handlers require their appropriate explicit validation. Do not put session cookies, GitHub tokens, PATs, or passwords into callback URLs.

References: [GitHub OAuth authorization documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [Device Authorization Grant / RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html).

## Five-platform handoff trade-offs

| Candidate                                  | Advantages                                                                                                                                            | Integration costs                                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser + bounded GitPulse handoff polling | Ordinary HTTPS and external-browser launch on all target platforms; no registered app callback; suitable for arbitrary compatible self-hosted origins | Extra waiting/cancellation state, temporary server transactions, polling load and expiry behavior                                                              |
| Custom URI scheme                          | Can return focus to the app; app_links supports the five platforms                                                                                    | Windows registry/MSIX and runner forwarding; Android intent filter; Linux desktop/GTK integration; Apple URL scheme configuration                              |
| Desktop loopback plus mobile callback      | Desktop can use a system-assigned local port                                                                                                          | Different desktop/mobile integration paths and packaging/sandbox details                                                                                       |
| Verified HTTPS links                       | Domain association can establish callback ownership                                                                                                   | App/domain configuration is not naturally compatible with arbitrary self-hosted domains; a fixed central callback service would be a separate product decision |

Official integration references: [app_links Windows](https://github.com/llfbandit/app_links/blob/main/doc/README_windows.md), [Linux](https://github.com/llfbandit/app_links/blob/main/doc/README_linux.md), [macOS](https://github.com/llfbandit/app_links/blob/main/doc/README_macos.md), [Flutter Android App Links](https://docs.flutter.dev/cookbook/navigation/set-up-app-links), [iOS Universal Links](https://docs.flutter.dev/cookbook/navigation/set-up-universal-links), [Dart HttpServer.bind](https://api.dart.dev/dart-io/HttpServer/bind.html), [url_launcher](https://pub.dev/packages/url_launcher).

GitHub upstream PKCE and the GitPulse handoff verifier protect different boundaries. One does not replace the other. GitHub expiring OAuth tokens also require separate investigation during implementation: current `shared/types/auth.d.ts` retains an access token without a refresh-token/expiry contract.

## Refresh baseline and recovered records

- `server/utils/release-timeline-utils.ts` reads and advances the account history baseline when invoked for POST refresh and usable results are returned, including partial results.
- `server/utils/timeline-history-utils.ts` advances the baseline without adding recovered records. Those records require an explicit merge through `server/api/release-timeline/history.post.ts`.
- The web client detects recoveries in its timeline session and submits them through its history adapter. Flutter can omit that adapter/merge behavior while still inserting later-discovered releases into the normal timeline.
- GET `/api/release-timeline` without cursors can load the first round without advancing that baseline. It can still update a renamed repository's settings, so it is not strictly side-effect-free.
- A device-local baseline can avoid another client's refresh consuming this device's new-release reference point. A shared baseline can instead provide account-wide last-refresh semantics. This is a product choice, independent of the account-synchronized retention-days setting.
- If a local baseline needs a server timestamp, adapt the response to include the sampling time rather than assuming the existing GET already returns one.
