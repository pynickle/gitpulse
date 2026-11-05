---
status: accepted
---

# One public shell, one dashboard frame, one top-bar contract

The signed-out surfaces had drifted into three layouts and four shells. `landing.vue` and `native-login.vue` were the same two-panel auth card written twice — one with a Bulma hero, one with a flex column — differing in gutter, panel padding, card max-width, title scale, and whether a skip link existed at all. The error page drew its own navbar and hero outside any layout, so a 404 had a fifth, hand-rolled shell. The public navbar also could not fit a phone: brand and controls shared one non-wrapping row that needed 405–430px, and the hidden scrollbar made the overflow invisible instead of obvious.

The dashboard had the same problem in the other direction. The dashboard home is an in-flow frame of `frame − navbar` height. Every sub-page and detail overlay is a fixed, full-viewport layer that paints over the navbar, with its own header 4px shorter and tighter control gaps (`0.5rem` against the navbar's `0.75rem`). A sub-page also mounted the layout navbar underneath the overlay, so two language switchers and two color-mode toggles existed in the DOM on every sub-page.

## Decision

Two shells, and nothing else:

- `PublicShell` — the signed-out shell. It owns the skip link, the navbar, `--gitpulse-frame-height`, and the page gutter. `layouts/default.vue` wraps every route that names no layout, so the landing pages, the native approval page, the Browser Launch Link entry, and the error page all render it. `app/error.vue` uses the same component rather than drawing a second chrome.
- `DashboardOverlayFrame` — the dashboard home frame and every dashboard child page.

Both share one top-bar contract: height `--gitpulse-topbar-height`, the same horizontal padding, and the same trailing group (GitHub link, `LanguageSwitcher`, `ColorModeToggle`) at the same gap. The leading slot differs by context — brand on the dashboard home, Back/Home on a child page — but never the height. The overlay header keeps its own `surface-muted` background; only the geometry is shared.

`PublicAuthCard` is the signed-out card: landing and the native approval page pass their copy as props and their interactive panel as the slot, so they cannot drift apart again. Sub-pages and detail overlays are the visible frame height, not an extra-tall viewport layer, and the layout navbar no longer renders behind them.

Below 480px the public navbar wraps its controls onto a second row instead of pushing the last one off screen, and button padding scales with the card.

## Consequences

- `app/layouts/landing.vue` and `app/layouts/native-login.vue` are gone, and signed-out routes name no `appLayout` at all; Nuxt's `default` fallback is the public shell.
- `app/error.vue` renders inside `PublicShell`, so it gains the skip link and the `main` landmark it did not have.
- The dashboard home and its child pages now share a height and a chrome; the navbar's controls no longer exist twice on one page.
- The landing copy is left-aligned at every width. The centered hero depended on `has-text-centered` leaking into the auth form's labels, which also centred them on wide screens.

## Considered options

- **Keep three layouts and only fix the route rules.** The two signed-out layouts are the same card written twice; leaving them apart is what let the phone layout break in only one of them.
- **Put dashboard sub-pages in flow under the navbar instead of a fixed layer.** It would have required re-deriving every `100vh`/`100dvh` constant and the sticky-header geometry, for the same visible result the shared height token gives.
- **Extract the top header's mobile "more" menu into the navbar too.** Deferred: the public navbar wraps instead, which keeps every control reachable without a second menu implementation.
