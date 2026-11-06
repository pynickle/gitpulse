---
status: accepted
---

# A press paints nothing, and only a hovering pointer paints a tint

ADR 0032 owns the two clients' interaction vocabulary: **a press paints no background, hover and
keyboard focus paint the one half-strength tint, and a filled or tonal surface keeps an answer to a
press.** It also hands the web app one row of that vocabulary on its own terms — `surface-hover` is
"a static background the web app puts under a row the pointer is on", where the Flutter client lays
an overlay instead. It does not say what the web app does with that background when there is no
pointer to put under. This record decides that, and the state it names.

## The rule

A touch leaves no tint. A tap paints neither the platform's own highlight nor a background the app
authored for a pointer; a press paints nothing at all; a filled surface answers it with a deeper tone
of its own fill; only a hovering fine pointer paints the hover tint; only the keyboard paints focus.
The word for the failure is **Hold** (`CONTEXT.md`): a tint left painted after the input that caused
it is gone.

## What was painting the blue wash

The reported symptom had four sources. They look identical to a reader, and only the fourth is
something the platform does rather than something the app does:

1. **The platform's tap highlight.** One surface in the whole client had turned it off — the
   dashboard top bar — and every other control flashed the browser's own blue rectangle.
2. **Ungated hover backgrounds.** 178 of the 181 `:hover` declarations that paint a background sat
   outside any pointer-capability query, so a tap applied the hover rule and nothing released it:
   a touch has no pointer to leave with, so the row kept its tint until another row was tapped.
3. **Hover paired with focus.** 39 of those declarations shared a selector list with `:focus`, and one
   card list painted `:focus-within` — so a tap that focused a control _inside_ a card shaded the
   whole card and kept it shaded, because a focus is not released by lifting the finger.
4. **`:active` backgrounds.** Five declarations answered a press with `--bulma-background-hover`, which
   is the same tint by another name.

43 of the 181 painted a blue-family tone — `info-soft`, `accent-soft`, `surface-active`, the
`*-solid-hover` steps, `accent`, `info`, `link`. The other 138 painted `surface-hover`, which reads
grey on a phone and is the same defect; a rule that fixes only the blue ones would have to be
re-audited every time a surface changes tone.

## Capability, not width

The gate is `(hover: hover) and (pointer: fine)`, not the shell's 860px narrow cutoff (ADR 0004) and
not a phone-width query. A phone in landscape and a tablet are still touch however wide they get, and
a tablet with a trackpad genuinely hovers. The cost is stated so it is not rediscovered as a bug: a
hybrid machine whose _primary_ input is touch loses the mouse and trackpad hover tint even when a
mouse is attached, because `pointer: fine` is false. That is accepted — the inverse error, a touch
device that holds a tint, is the defect this record exists to end.

## A press paints nothing and moves nothing

ADR 0032's rule is adopted without a web-side supplement: **a press paints no background**, and the
web client adds no movement either. This is the one place the web client deliberately goes further
than the Flutter client's history — the first draft of this record answered a press with `scale`, and
that answer was removed on the owner's judgement that a control which squishes under the finger reads
as a toy, and that the settled state after the press is the feedback the reader actually asked for.

It also leaves ADR 0032's own escape hatch unused: a pressed surface moving its hairline toward the
Accent. A hairline is invisible on the many surfaces that have none (a bare row, a card, an icon
button), and the client already spends ~250 declarations on outlines and border colours, so the
channel is not free. If a press is ever judged dead in review, that remedy — not a tint and not a
transform — is the one to reach for, and it needs its own record.

`prefers-reduced-motion` therefore has nothing to suppress here: the client never moves a control
under the finger, so the motion preference changes nothing about a press.

## A filled surface keeps an answer

Inherited from ADR 0032 unchanged. A control that already paints a solid fill — `.button.is-primary`
and its five siblings, and the `$brand-primary` submission and save controls — answers `:active` with
its own tone one step deeper. This is the only `:active` background the web client allows, it is a
different tone of the same fill rather than a wash over it, and it is the one place a touch device
would otherwise get no answer at all, because the deeper tone previously sat behind `:hover`.

## Selection and callout

A long press on chrome pulled up the platform's selection wash and its copy menu, which is never what
a reader meant by tapping a row. Chrome now refuses `user-select` and `-webkit-touch-callout`; prose,
documents, code and fields keep both, because a reader who cannot select a paragraph cannot copy it.

The single list in `_pointer.scss` is the boundary. `[role="button"]` and `.dashboard-list-card` are
deliberately absent from it: both are usually a title a reader may want to select, and refusing a
long-press menu does not have to take the text away with it. A component that owns a surface under its
own class label keeps its own `user-select: none` (the label editor's rows, the reviewer picker's
candidates): the shared list covers the generic names, and inventing a shared list of every
component's class names would couple the foundation to the components instead.

`touch-action: none` on a drag surface — a drawer's handle, a splitter, a diff pane being panned — is
not this record's gesture policy and stays where it is: it belongs to the drag, not to the tap.
`::selection` stays the product's own (`accent-soft`); it is simply no longer reachable on chrome.

## Where the contract lives

- `app/assets/scss/_pointer.scss` states the capability query, the selection list and the one mixin:
  `hover-only` is the way a stylesheet writes a hover state.
- The base layer in `app/assets/scss/main.scss` carries what must hold for the document rather than
  for one component: `-webkit-tap-highlight-color` on the universal selector (its inheritance is not
  dependable in older WebViews), `touch-action: manipulation` on `html` (a tap must not wait for a
  double tap, and pinching still zooms), and the chrome selection rule.
- `modules/hover-gate/` is the local Nuxt module that registers the build step. It moves every
  `:hover` rule in every compiled stylesheet — global, scoped, and Bulma's own — inside the same
  query, and a rule already inside it is left alone, so the mixin and the gate compose instead of
  nesting. `plugin.ts` is the transform and `index.ts` only installs it; the directory is the shape
  Nuxt documents for a project's own module.

## What is enforced, and how

The base layer and the mixins are executable CSS. The **gate is enforced by the build**, not by
memory: a stylesheet that writes a bare `:hover` still cannot ship one, and a component added next
year is covered without its author knowing this record exists. That is the same shape ADR 0032 uses
for the Flutter client — "the rule is enforced by the theme's shared resolver and by this record, not
by memory" — and it is why the gate is a build step rather than a convention.

The gate was weighed against two alternatives and rejected on evidence:

- **A repository check that scans stylesheets for a bare `:hover`.** Rejected: it adds a sixth CI step
  and a static source scan the project's test rule would have to carve out as an exception. It also
  enforces, where the build can simply decide.
- **A published PostCSS plugin.** `postcss-hover-media-feature` is the popular one (~120k downloads a
  month) and the closest fit, but its last release is v1.0.2 from January 2022, it wraps with
  `(hover: hover)` alone and offers no option for `and (pointer: fine)`, and a vulnerability is
  flagged against it. Adopting it would have meant shipping a weaker query than this record decides,
  from a package nobody maintains. Thirty lines of our own, with the query as a named constant, are
  both smaller and exact.

The gate's own behaviour is asserted by `tests/hover-gate.test.ts`, which runs the real PostCSS
pipeline: a hover rule moves inside the query, a non-hover rule is untouched, an already gated rule is
not double-wrapped, a width query keeps its block, a list mixing a hover arm with a focus arm is split
rather than gated whole, the module installs the plugin on the build config, and the query equals the
one the Sass mixin emits.

## Consequences

- Every hover-background declaration across the client sits behind one query — the 181 that existed in
  77 files when this record was written, and every one written afterwards. A touch applies none of
  them, and a stylesheet that writes a bare `:hover` is out of spec even though the build still
  covers it.
- The local policies that preceded this record are gone rather than left as precedents: the dashboard
  top bar's `-webkit-tap-highlight-color` line and its `transform: scale()` squish, and the chrome
  actions' hand-written `@media (hover: hover)`. Nothing replaces the squish.
- Five `:active` backgrounds are deleted, together with the reduced-motion resets that existed only to
  restore them. `:active` now changes tone, opacity, shadow or cursor, and never a surface.
- A hover that a keyboard also reaches is split into a gated `:hover` and an ungated `:focus-visible`.
  Form fields keep bare `:focus`: a field is tinted because the reader is typing in it, which is not a
  hover and must survive on a phone.
- `:focus-within` that shares a selector list with `:hover` is gated with it. A card that shades
  because a control inside it took focus is a Hold on touch and stays a hover affordance on a desktop.
- No surface declares the tap highlight, the gesture or the selection boundary for itself any more; a
  new component inherits all three.
- The one thing the gate cannot decide is intent: a `:focus-within` that _reveals_ a control (a row's
  add button, a drag handle) is a keyboard affordance and must stay outside the query, while a
  `:focus-within` that _tints_ a card joins it. The two are told apart by what they paint, and a reveal
  wrongly gated is a mess a keyboard reader on a touch device can see but a mouse user never will.
