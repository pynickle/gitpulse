# Native Login Handoff

An OAuth-enabled GitPulse server can authorize a Flutter login using the system
browser. The app receives its own Nitro Cookie session through
`establishGitHubSession()`. GitHub credentials and session cookies never appear in
browser URLs, and the app never imports browser cookies.

Enable GitHub OAuth through the existing provider configuration and set a strong
`NUXT_SESSION_PASSWORD` (at least 32 characters). Discovery advertises
`native-login-handoff` only outside personal mode, with usable OAuth configuration,
a session encryption key, and an `fs`, `redis`, or `upstash` storage driver.
`resolveAuthProviderState()` remains the provider authority. Password/PAT login
does not depend on this capability.

## Protocol

Paths below are relative to the deployment's app base URL. The app's `origin`
is the canonical backend origin, including scheme and port, without a trailing
slash or deployment path. No redirects are followed by the native HTTP client.

1. Generate a fresh, cryptographically random verifier in the app. POST
   `/auth/native/create` with `{ challenge, origin }`, where `challenge` is the
   unpadded base64url SHA-256 digest of the verifier. Keep the verifier in memory.
   The response supplies `id`, `browserUrl`, `confirmationCode`, `expiresAt`
   (epoch milliseconds), and `interval` (seconds).
2. Open `browserUrl` in the external system browser. `/native-login` displays
   the matching confirmation code and uses the existing `/auth/github` flow with
   a same-origin return target. An already authenticated GitHub browser session
   can also approve. The user explicitly approves a CSRF-protected form; approval
   is a mutation, never a side effect of a GET or OAuth return.
3. While foregrounded, GET `/auth/native/status?id=...` with headers
   `x-native-verifier` and `x-native-origin`. Repeated reads expose transaction
   status only and never establish an authenticated app session. Polling pauses
   while the app is inactive/hidden and resumes when it returns to the foreground.
4. For `approved`, POST `/auth/native/redeem` with `{ id, verifier, origin }`.
   The server atomically consumes the result before writing the app's session.
   The response contains public user data and the app's own HttpOnly session
   cookie, handled by its secure Cookie jar.
5. POST `/auth/native/cancel` with the same proof to cancel a pending or approved
   attempt. Cancellation is idempotent. Cancelled, expired, and redeemed attempts
   cannot mint a session. A lost redemption response requires a new attempt.

Every POST requires the existing CSRF cookie/header contract. The browser's
HTML approval form submits the same double-submit token in its body and is also
subject to Origin/Referer validation. The existing CSRF plugin issues the token.
The browser page denies framing and scripts and uses no-store and `same-origin`
referrer headers; `no-referrer` is deliberately avoided because the browser then
serializes the approval form's `Origin` as the literal `null`, which the
double-submit check rejects. App verifier values are sent only to the selected
backend and never in URLs.

The handoff verifier is independent of GitHub's upstream authorization state or
PKCE: the existing GitHub OAuth handler retains its existing responsibilities.
This handoff does not introduce GitHub Device Flow, custom callback registration,
a WebView, a central callback service, or another session authority.

## Transactions and deployment

Transactions expire after ten minutes. They use the existing configured storage
adapter in the separate `native-login-handoff` collection, isolated from account
settings. The browser proof is hashed. Approved grants are authenticated-encrypted
with a key derived from the session encryption secret; consumption, cancellation,
and observed expiry remove the grant. Keep storage access restricted as for
existing server sessions. Transaction records remain as tombstones; storage
maintenance may remove records older than their expiry. No long-term credential
is retained in the native pending-attempt state.

Redis/Upstash use the existing distributed commit fencing. Filesystem deployments
also acquire an exclusive file lock for each transaction, so workers sharing one
filesystem cannot both redeem a grant. If a worker crashes holding a lock, that
attempt fails closed: start a new attempt. Old lock files may be removed after
the transaction's ten-minute lifetime. Multiple hosts must share an appropriate
storage authority; use Redis or Upstash for deployments without shared local
storage. A stable session encryption key is required across workers/restarts.

## Verification

Run `bun test tests/native-login-handoff.test.ts tests/native-capabilities.test.ts`
and, from `flutter/`, `flutter test`. The tests cover HTTP creation, browser
approval, independent sealed sessions, restoration, verifier/origin rejection,
CSRF, expiry, cancellation, replay, concurrent redemption across two actual server
processes, foreground resumption, and cancellation of obsolete responses.
The cross-language test runs local source handlers through Bun with isolated
temporary storage. Only the external GitHub success boundary is simulated.

Windows/Android system-browser behavior and the remaining platform prerequisites
still need native device verification; automated tests do not claim it.
