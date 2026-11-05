---
status: accepted
---

# Route-rule keys are portable across both matchers

One `routeRules` object is read by two different matchers, and they agreed on nothing that mattered:

- Nuxt compiles the keys into a rou3 matcher (`#build/route-rules.mjs`) for the client and SSR layout selection. In rou3 0.9 an `addRoute` loop breaks at the first `**` segment and discards the rest of the pattern, so `/**/dashboard` registers as the root wildcard — a catch-all that matches `/`, `/zh-cn`, `/foo` and every other path.
- Nitro 2 matches the same object with radix3 for response headers, prerender and redirects. There a `**` before the last segment matches nothing at all.

The two failures are opposite and both silent. `/zh-cn` resolved the `dashboard` layout for the Chinese landing page, and the native approval response headers (`X-Frame-Options`, `frame-ancestors`, `no-store`) never reached any locale-prefixed path, because the rule that carried them could not match. Nuxt emits no warning: a mid-path `**` normalises like any other key, and the router compiler only rejects a suffix after a wildcard that the registration step never built.

## Decision

Route-rule keys stay inside the subset both matchers interpret identically: static segments, a single-segment `*`, and a trailing `**`. Locale prefixes are never written as `/**/`; `localeVariants()` in `shared/utils/app-locales.ts` expands one authored pattern into one key per configured locale, with the default locale unprefixed.

`tests/route-rules.test.ts` pins the contract: it resolves the real config through both engines and asserts the layout, the prerender decision and the headers for a path table, and it rejects any key whose `**` is not the last segment.

## Consequences

- The rule set grows with the locale list instead of staying at one line per surface. A new locale is picked up automatically; nobody has to remember a second rule.
- The same expansion applies to anything else keyed by path for the same reason: `robots.disallow` now covers the locale variants it was missing.
- When Nitro moves to rou3, the decision does not change. rou3 1.0 registers a mid-path `**` as a suffix node but rejects a pattern with two wildcards, so `/**/dashboard/**` would fail the build there. The explicit expansion is the shape that survives both.

## Considered options

- **Keep `/**/` and wait for a newer rou3.** It leaves the server-side headers dead in the meantime, and rou3 1.0 rejects the two-rule shape this rule set needs.
- **Use `/*/dashboard`.** It works in both matchers, but it means "any single leading segment" rather than "a configured locale": it misses the unprefixed default locale and would give a non-locale prefix the dashboard shell.
- **Override rou3 to 0.10+.** It cannot fix the radix3 side, and it would make the client and the server disagree in a new way.
- **Patch Nuxt's `route-rules.mjs` template from a module.** There is no public hook for it, and it fights the framework for a rule set that reads fine when spelled out.
