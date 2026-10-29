# Flutter startup and session restoration

Accepted direction: show saved content as soon as local restoration permits it,
and validate the connection and session in the background.

Cold startup presents one themed loading surface using `GitPulseLoadingView`
while reading the remembered backend and secure session. It does not present a
sign-in form during restoration and has no minimum display duration. A first
installation still discovers the default backend before offering its providers.

For a remembered backend with saved compatible capabilities, discovery refreshes
in the background. A matching securely stored identity and a usable session
cookie permit immediate access to that account's Saved Visible Timeline. A
missing timeline shows the existing timeline loading state. A cookie without a
saved identity remains on the startup surface until the session check resolves;
an identity without a usable cookie does not grant access.

Account API requests wait for the initial session check to finish. Successful
validation continues normal loading and refresh. An explicit authentication
rejection, including a successful response with no authenticated user, hides
saved content and offers sign-in. Network failure retains offline reading;
transient server errors preserve the existing session failure handling. The
accepted trade-off is that an expired session can briefly show saved content
before the server rejects it.

Sign-out and backend changes invalidate pending restoration and account work.
Refreshing capabilities must not reconnect a backend the user has left. Fresh
incompatible capability responses retain the existing connection error flow.
Foreground return keeps its existing reading and browser-login behavior.

Saved capabilities must include `release-note-search-text`, the capability that
supplies the release-note text used by offline search. Updating from an earlier
client requires one successful connection to the updated backend and a timeline
refresh because the old timeline cache is rebuilt. Login, device preferences and
Release Follows are preserved. See [ADR 0036](adr/0036-server-owned-release-note-search-text.md).

Behavior checks mount the real app with controlled HTTP and secure-storage
boundaries, and a real SQLite timeline cache. They assert the rendered loading,
saved-content and sign-in states while startup work is deliberately delayed,
then complete it with success, offline failure or explicit rejection. Existing
session and connection suites continue to cover provider selection, credential
storage and backend compatibility.
