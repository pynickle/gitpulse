---
status: accepted
---

# Retire Bulma through a layered compatibility stopgap and own web styles in scoped SCSS

`nuxt.config.ts` loads the full unlayered `bulma/css/bulma.min.css` bundle (662 KB raw) ahead of `app/assets/scss/main.scss`. An SFC template AST audit of the 218 web `.vue` components showed that actual Bulma dependence is much narrower than plain-text counts suggest: zero components use Bulma's 12-column responsive grid (all six `.columns` hosts — `DashboardLayout.vue` and the five Detail Overlays via `_detail-sidebar-columns.scss` — already override it with CSS Grid or custom flex), and zero components use `.modal*`, `.dropdown*`, `.table`, `.panel`, `.section`, `.container`, `.content`, `.footer`, `.message`, `.breadcrumb`, `.progress`, `.select`, or `.file`. Meanwhile, Bulma still imposes four recurring costs: `minireset` silently strips `list-style` and margins from `ul`/`ol` (invisible in `happy-dom` tests), `!important` helpers force override hacks such as `dashboard.vue`'s narrow scrollbar clearance, `.content` collides with `@primer/css` `.markdown-body`, and `main.scss` carries ~90 lines of `--bulma-*` token bridges plus ~470 lines of overrides (~120 of them dead) alongside 68 files still reading `--bulma-*` (79% of which is `--bulma-text-strong`, mostly already carrying a `--gitpulse-*` fallback).

At the same time, `app/assets/scss/` has accumulated mixed responsibilities: an 845-line `main.scss` combining tokens, scrollbars, ADR 0049 document rules, and Bulma overrides; inconsistent `_` partial prefixes and import paths; two-component feature stylesheets (`notification-card.scss`, `reviewer-modal.scss`) placed in the global directory; and filenames drifted from domain terms (`card.scss` styles dashboard list cards, `reviewer-modal.scss` serves both reviewers and assignees, and `detail-metadata-editor.scss` is borrowed as a generic modal shell by `ConfirmModal`, `IssueCloseModal`, and `CommentActions`).

## Decision

1. **Retire and uninstall Bulma; do not adopt a replacement CSS framework.**
   Web styles stay in native CSS and Vue `<style scoped lang="scss">` driven by the cross-client Foundation Layer (`shared/data/theme-palette.json` + `--gitpulse-*` tokens) and `_pointer.scss` (ADR 0049). `@primer/css` remains strictly scoped to `.markdown-body` in `MarkdownRenderer.vue` for GitHub-flavored Markdown prose, never for app chrome.

2. **Phase 1 stopgap: modular Bulma whitelist inside `@layer reset, bulma;` without `!important` helpers.**
   Replace `bulma/css/bulma.min.css` with a modular SCSS entry declaring `@layer reset, bulma;`, leaving application global styles and Vue scoped styles unlayered so they win over both base layers by cascade order alone.
   - **In-house `@layer reset`**: exclude Bulma's `minireset` and `generic`, and author a minimal reset (`box-sizing: border-box`, media bounds, baseline element resets aligned with `--gitpulse-*` and ADR 0049) that does **not** globally strip `list-style` on bare `ul`/`ol`. Audit the 15 components rendering `<ul>`/`<ol>` so UI lists opt into `list-style: none` explicitly.
   - **No `!important` inside `@layer bulma`**: CSS Cascade Level 5 reverses layer priority for `!important` declarations, so layered `!important` overrides unlayered `!important` — naively layering Bulma's `helpers/*` would break dark-mode `.has-text-*` overrides in `main.scss` and narrow scrollbar clearance in `dashboard.vue`. Exclude Bulma's `helpers/*` from the whitelist and serve only the ~55 helpers currently present in templates from a thin, non-`!important` compatibility sheet inside `@layer bulma`. Drop all 13 unused Bulma modules and ~120 lines of dead overrides in `main.scss` immediately.
   - `modules/hover-gate/` wraps `:hover` rules in-place inside `@layer` blocks and remains compatible; pin that behavior with a test in `tests/hover-gate.test.ts`.

3. **Target primitives and helper retirement.**
   - **Spacing, flex, typography, and color helpers** (`m/p-*`, `is-flex`, `has-text-*`, `is-size-*`, `.title`/`.subtitle`) are not replaced by a new global utility library; they fold back into component `<style scoped>` using `gap`, margins, and `--gitpulse-*` tokens. Only `.sr-only` remains a global accessibility utility.
   - **High-frequency controls** (`.button`, `.tag`, `.notification`, and the 7–8 form files) converge on thin semantic primitives — evolving `app/components/ui/Button.vue` alongside lean semantic styles — and retire Bulma's `is-*` modifier vocabulary.

4. **Two-layer guardrails without source-regex tests.**
   Honor `AGENTS.md` (no source-text regex assertions in `tests/`) and ADR 0048 (single local + CI hook gate):
   - **Build-time whitelist**: removing a Bulma module or helper entry the moment its last caller exits makes reintroduction immediately unstyled.
   - **Ratchet hook in `prek.toml`**: add a local hook script (`scripts/check-bulma-ratchet.ts`) that caps remaining `--bulma-*` and Bulma class counts monotonically (flat or decreasing only, never increasing) so local commits and CI enforce the freeze from one entry point, paired with a brief pointer in `AGENTS.md`.

5. **Reorganize `app/assets/scss/` in independent PR(s) by responsibility.**
   - Split `main.scss` into focused partials (`tokens`, `base`/`reset`, `scrollbars`, temporary `bulma-compat`), standardize `_` prefixes strictly for zero-output Sass partials (mixins/variables) and normalize import paths, and remove `$brand-primary` duplication against `--gitpulse-*`.
   - Rename drifted shared sheets (`card.scss` → `dashboard-list-card`, `reviewer-modal.scss` → `people-picker-modal`) and co-locate narrow two-component feature sheets (`notification-card`, `people-picker-modal`) beside their owning components.
   - Extract the generic modal shell (overlay, panel, header, footer, transitions) out of `detail-metadata-editor.scss` so `Metadata Editor Modal` keeps its narrow `GLOSSARY.md` meaning (labels and issue type editors).

## Considered options

- **Keep a pruned Bulma permanently in `@layer bulma`.** Rejected: with zero grid or complex component usage, maintaining dual `--bulma-*`/`is-*` vocabulary and overrides permanently is pure overhead for ~250 lines of remaining primitives.
- **Freeze and replace without a Phase 1 stopgap.** Rejected: leaves `minireset` list traps, `!important` helper conflicts, and 662 KB of unlayered CSS active across every feature PR until the final uninstall lands.
- **Adopt Tailwind CSS / UnoCSS or a Vue UI component library.** Rejected: over 85% of the web client is already custom scoped SCSS + BEM, GitPulse owns a cross-client palette (`shared/data/theme-palette.json`) and pointer contract (ADR 0049), and another CSS framework would reintroduce reset, token, and hover-gate conflicts.
- **Enforce the Bulma freeze through `tests/` static file scans.** Rejected: violates the repository's behavior-only test rule and adds a parallel check outside `prek.toml`.

## Consequences

- Every Phase 2 cleanup PR shrinks the Bulma whitelist (or non-`!important` helper compat sheet) and lowers the `prek.toml` ratchet baseline in the same change until `bulma` is removed from `package.json`.
- Excluding `.content` in Phase 1 removes the root cause behind `tests/markdown-host-bulma-isolation.test.ts`; that test can be simplified or retired once Bulma `.content` no longer ships.
- `GLOSSARY.md` stays unchanged: `Metadata Editor Modal` keeps its narrow scope while the shared modal shell becomes a separate presentation primitive.
- Existing `app/assets/scss/` reorganization ships as separate, behavior-neutral PR(s) so file moves do not obscure Bulma cascade changes in review.
