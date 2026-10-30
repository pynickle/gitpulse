---
status: accepted
---

# Identify Flutter accounts by backend and numeric GitHub ID

Flutter uses the backend base URL and numeric GitHub ID as its single Account Identity across sign-in, restoration, Release Follows, Repository Discovery and timeline caching. A renamed login, including a capitalization change, preserves reusable page state and cached history; a different ID or backend is an account change even when the login matches.

The identity module owns account equality and scope, with the canonical backend base URL retaining its base path. Login, name and avatar are mutable profile data. The session controller owns authentication, restoration, rejection, credential cleanup and identity transition notifications; the consuming modules use the same identity rather than constructing their own keys. Every accepted identity has a numeric GitHub ID, so there is no separate temporary or persistence-eligible identity category.

Sessions without a numeric GitHub ID are unsupported. Remove login-based identity fallbacks rather than preserving compatibility with those sessions: this deliberately gives up legacy-session continuity so account equality and data isolation follow one rule.

When startup finds a saved identity without a numeric GitHub ID, clear that backend's local session credentials and account cache, then return to sign-in while preserving device preferences and backend configuration. Do not expose that identity, repair it through the session endpoint, or wait for a remote logout request.

A successful authentication response without a numeric GitHub ID violates the client contract for password, PAT and browser sign-in alike. Reject session establishment, clear credentials obtained by that attempt, and report that the backend returned an incomplete account identity.

The same contract applies during restoration even when the saved identity has a valid ID: a successful response containing a user without a numeric ID clears that backend's local credentials and account cache and returns to sign-in with the incomplete-identity error. Network failures continue to permit existing offline reading; ordinary authentication rejection retains its existing behavior. Explicit sign-out continues to clear local account data, even if the next sign-in is to the same account.

Behavior tests drive the real session through password, PAT and browser sign-in and startup restoration. They cover rename continuity, same-login account changes, local rejection of unsupported saved identities, incomplete server identities, credential and cache cleanup, and continued offline reading. SQLite reopen tests verify that retained history survives a rename but cannot cross backend base paths or account IDs.
