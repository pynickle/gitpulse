---
status: accepted
---

# Refresh Flutter UI through shared theme roles and native components

The user approved a Flutter presentation redesign on 2026-10-27: replace the Settings table with separate labeled cards without repetitive descriptions, give Release Follows fixed web-style source/sort controls and numbered pagination, add repository identity/avatar and release-follow/share actions, improve the shared Markdown reading style, and add a timeline spine while retaining date-group grids on wide windows. This is the accepted target; implementation follows the specification in `../flutter-ui-redesign-spec.md`.

The Settings card structure deliberately replaces the table-only convention in `flutter/AGENTS.md`. Labels and controls still carry their own meaning; the reference images do not authorize repeated explanatory subtitles. Existing device-preference ownership, follow confirmation, cache and refresh semantics, and ADR 0023's press-feedback policy remain in force.

The repository's release-list, follow, and share actions remain on one row on narrow screens. The user explicitly rejected splitting them into two rows; compact spacing and localized labels should make the layout fit while preserving the release-list action's visual priority.

Keep the current native Material theme and registered presentation tokens as the owners of visual decisions. The user plans a future theme system, so new surfaces obtain semantic colors and shared text/shape roles from those owners rather than copying green colors or local style systems. Implement only the roles needed for this redesign; theme selection, custom-theme storage, and a general theme framework remain future work.

Keep the existing shared Markdown renderer initially. Its app-owned code block already supports highlighting, copying, and horizontal scrolling, so the requested card styling and inline-code treatment do not justify replacing the dependency stack. A future replacement needs a concrete unmet requirement and must preserve existing rendering contracts.

On 2026-10-27 the user cancelled the timeline-spine work in Issue #137, so that part of the original target above is withdrawn. The same session established concrete document failures (lost author alignment and misrendered SVG badges); [ADR 0027](0027-flutter-native-document-svg-boundary.md) authorizes Rust resvg at the SVG image boundary while retaining native document layout and code blocks. The updated Issue #136 is the remaining implementation entry under #132, and the specification's dated amendment takes precedence over its earlier dependency freeze and timeline-spine wording.
