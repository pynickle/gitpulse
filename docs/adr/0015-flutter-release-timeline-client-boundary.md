---
status: accepted
---

# Keep the Flutter Release Timeline client alongside the existing Nitro backend

Build the publicly distributable Flutter application in the GitPulse repository, reusing the existing Nitro backend and the same account's Release Follows. Unlike the broader web application, its product boundary is Release Timeline and necessary repository/release surfaces; issues and pull requests are excluded. Allow necessary backward-compatible Nitro adaptations rather than making the new client reproduce every constraint of the current web-facing protocol.

An independent Flutter repository was considered for separate development and releases. Keeping it here instead allows API adaptations and client changes to be reviewed together. Place the client in flutter/, use application identifier ink.euphony.gitpulse, and release it with independent flutter-vX.Y.Z tags. Users configure a compatible self-hosted GitPulse backend rather than being restricted to one hosted domain; require the native capabilities instead of degrading features on old servers. ADR 0017 records the selected native authentication flow.

The Flutter scope excludes the web application's permanent Recovered Release History list and management UI, and does not require a recovered-record merge adapter. The user explicitly chose to share the account's Timeline Refresh Baseline with web and app clients, so a usable native refresh may affect another client's new-release reference point. Local cache contents remain device-local.
