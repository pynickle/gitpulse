# Stable browser launch entry

Browser integrations use `/open?url=<GitHub URL>` as GitPulse's public launch contract. The entry
resolves the target inside the web app and carries the destination through authentication, so the
extension remains a navigation-only launcher while dashboard route details evolve independently.

The former `/dashboard?url=` handoff is intentionally unsupported. Links without a matching
GitPulse surface are rejected with an unsupported-link state instead of being redirected to an
unrelated page.
