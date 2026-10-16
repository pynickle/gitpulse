---
status: proposed
---

# Unify application-controlled scrolling with SimpleBar

GitPulse currently uses SimpleBar for the ordinary Dashboard Home list and Widgets,
while many other internal surfaces use native scrollbars. Unify application-controlled
scroll containers in the main web app on the existing `simplebar-vue` integration,
including lists, panels, overlays, dropdowns, and code browsing. Use automatic hiding
and a shared appearance for scrollbar thickness, color, and hover feedback. These
scope and display decisions were confirmed during the design interview.

Document-level scrolling, native textareas, and scrollable content generated from
Markdown remain explicit exceptions. SimpleBar does not support direct attachment
to body or textarea elements; generated content also needs separate treatment rather
than ordinary Vue component substitution. Requiring identical scrollbars everywhere
was rejected in favor of consistent application-controlled containers with bounded
exceptions. SimpleBar retains native scrolling behavior while replacing its visual
scrollbar.

Native textarea scrollbars and scrollable Markdown code blocks and tables use CSS
to approximate the same colors and thickness. Browser differences are acceptable;
automatic hiding is not required for these native exceptions. Document-level
scrolling keeps its existing behavior and scrollbar visibility. This treatment of
the exceptions was also confirmed during the design interview.

## Consolidated migration proposal

Introduce one shared `ScrollArea` component backed by `simplebar-vue`, centralizing
the library stylesheet, defaults, and scrollbar appearance. Both vertical and
horizontal application-controlled scrolling use this component. Migrate the two
existing direct SimpleBar usages as well as the remaining in-scope native containers;
do not initialize SimpleBar globally on arbitrary DOM nodes or generated Markdown.

The component provides access to its actual scrolling HTMLElement and forwards
scroll notifications from that element. Callers that need geometry, observers,
scroll positions, or virtualized content use that element rather than the component
shell. Its availability and replacement must be observable so consumers can bind
and clean up correctly during mounting and responsive layout changes. Feature
modules continue to own virtualization, pagination, scroll anchoring, position
restoration, and editor-preview synchronization.

Retain the existing scroll boundaries, sticky headers, focus behavior, dropdown
keyboard navigation, and sheet gestures. In particular, narrow Detail Overlays
keep their existing outer scroll ownership and do not acquire an extra independently
scrolling Detail Sidebar. PR Review Workspace retains Unified Diff horizontal
scrolling with stationary line numbers as required by ADR 0008; release overlays
retain the lifecycle and gesture boundaries in ADR 0010.

Implement in groups: the shared component and current SimpleBar usages; ordinary
panels, overlays, and dropdowns; virtualization and code browsing integrations;
then native exception styling. These are implementation steps toward the full
agreed scope, rather than a reduced scope that permanently leaves ordinary
application containers mixed.

Verify behavior at the scrolling-element boundary, especially virtualized ranges,
file navigation, scroll restoration and anchoring, keyboard navigation, and editor
synchronization. Run root tests, formatting, lint, and Nuxt typecheck according to
repository guidance. Application implementation has not started. This record
remains proposed pending confirmation of the consolidated design.

Reference: [SimpleBar documentation](https://github.com/Grsmto/simplebar/blob/master/packages/simplebar/README.md).
