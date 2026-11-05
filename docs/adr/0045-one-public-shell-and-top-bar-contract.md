---
status: accepted
---

# One public shell, one dashboard frame, one top-bar contract

The signed-out surfaces had drifted into three layouts plus a hand-rolled error chrome. `landing.vue` and `native-login.vue` were the same two-panel card written twice — one with a Bulma hero, one with a flex column — differing in gutter, panel padding, card max-width, title scale, and whether a skip link existed at all. The error page drew its own top bar and hero outside any layout, so a 404 had a fifth, hand-rolled chrome. The public top bar also could not fit a phone: brand and controls shared one non-wrapping row that needed 405–430px, and the hidden scrollbar made the overflow invisible instead of obvious.

The dashboard had the same problem in the other direction. The dashboard home is an in-flow `.dashboard-page` of `frame − top bar` height. Every child page and detail overlay is a fixed, full-viewport layer that paints over the layout top bar, with its own header 4px shorter and tighter control gaps (`0.5rem` against the top bar's `0.75rem`). A child page also mounted the layout top bar underneath the overlay, so two language switchers and two color-mode toggles existed in the DOM on every one.

## Decision

Two shells, and nothing else:

- `PublicShell` — the signed-out shell. It owns the skip link, the top bar, `--gitpulse-frame-height`, and the page gutter. `layouts/default.vue` wraps every route that names no layout, so the landing pages, the native approval page, the Browser Launch Link entry, and the error page all render it. `app/error.vue` uses the same component rather than drawing a second chrome.
- `DashboardOverlayFrame` — every dashboard child page and the detail overlays. The dashboard home is the layout's own `.dashboard-page` frame; both are `frame − top bar` high.

Both share one top-bar contract: height `--gitpulse-topbar-height`, the same horizontal padding, and the same trailing group (`ChromeActions`: GitHub link, `LanguageSwitcher`, `ColorModeToggle`) with one gap. The leading slot differs by context — brand on the dashboard home, Back/Home on a child page — but never the height. The overlay top bar keeps its own `surface-muted` background; only the geometry is shared.

`PublicAuthCard` is the signed-out card: landing and the native approval page pass their copy as props and their interactive panel as the slot, so they cannot drift apart again. Child pages and detail overlays are the visible frame height, not an extra-tall viewport layer, and the layout top bar no longer renders behind them.

Below the shell's 860px cutoff, `ChromeActions` collapses the language switcher and the color-mode toggle into a "more" menu, so one row fits a 320px viewport instead of pushing a control off screen. Button padding scales down with the card for the same reason.

## Consequences

- `app/layouts/landing.vue` and `app/layouts/native-login.vue` are gone, and signed-out routes name no `appLayout` at all; Nuxt's `default` fallback is the public shell.
- `app/error.vue` renders inside `PublicShell`, so it gains the skip link and the `main` landmark it did not have.
- The dashboard home and its child pages now share a height and a chrome; the top bar's controls no longer exist twice on one page.
- The landing copy is left-aligned at every width. The centered hero depended on `has-text-centered` leaking into the auth form's labels, which also centred them on wide screens.

## Considered options

- **Keep three layouts and only fix the route rules.** The two signed-out layouts are the same card written twice; leaving them apart is what let the phone layout break in only one of them.
- **Put dashboard child pages in flow under the top bar instead of a fixed layer.** It would have required re-deriving every `100vh`/`100dvh` constant and the sticky-header geometry, for the same visible result the shared height token gives.
- **Wrap the public top bar's controls onto a second row below 480px.** Rejected: it keeps every control visible but doubles the bar, while the dashboard bar already had a working menu to reuse.
