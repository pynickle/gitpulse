# Flutter Release Timeline Reading Position

Status: confirmed by the user; implementation authorized.

## Confirmed scope

- Apply to the Flutter client only.
- Preserve the Release Timeline reading position when switching to another in-app tab and returning.
- Preserve it during the current application run only. A full application restart may open the timeline at the top.
- Restore the same release and, as closely as possible, the same place within its card. A raw scroll distance alone does not define successful restoration.
- An explicit timeline refresh returns to the top.
- Changing timeline search or filter conditions returns to the top of the resulting list.
- If the release being restored is no longer in the visible timeline, return to the top without fetching old content solely to restore the position.

## Acceptance scenarios

1. Read partway through a release card, switch to Follows, and return to Timeline without changing the data or filters: the same release and approximately the same place within its card are visible.
2. Repeat through Settings and across repeated tab switches: the position remains available during the same application run.
3. Explicitly refresh the timeline: display the top of the timeline instead of restoring the earlier position.
4. Change search or filter conditions: display the top of the resulting list.
5. Unfollow the repository of the release being read and return to Timeline: if that release is no longer visible, display the top without additional history requests for position restoration.
6. Fully close and restart the application: restoring the previous reading position is not required.
7. Change window width while another tab is open: restore the same release. If its card has become too short for the old inset, show that release from its beginning rather than scrolling it out of view.

## Existing constraints

- Use the vocabulary in `../CONTEXT.md`.
- Timeline Refresh Baseline is shared refresh state and does not represent reading progress.
- Retained release history and Saved Visible Timeline have their existing boundaries under ADR 0016; preserving a reading position does not change those boundaries.

## Implementation before this change

- Flutter has three main tabs: Timeline, Follows, and Settings. They currently use separate routes that build only the selected destination.
- The timeline list owns a scroll controller with offset persistence disabled; leaving the tab destroys its local reading-position state.
- The timeline session retains data independently of that widget. Losing the position is distinct from losing cached release data.
- Existing list-update anchoring preserves a visible release only while the same list widget remains mounted.
- Responsive timeline layouts use one to three columns, so a saved pixel distance alone may refer to different content after resizing.

## Implementation and verification

- Keep the reading release identity and viewport-relative position in memory across tab widgets, scoped to the current session identity.
- Reuse the list's centered-sliver layout to restore the release without estimating the height of earlier cards or requesting more history.
- Measure the anchor card before applying its saved inset, so a card that shrank after reflow remains visible.
- Reset the list for explicit refresh and search/filter changes. A refresh also returns to the top when its response arrives, including when another tab was visited while waiting.
- The agreed test seam is Flutter widget tests mounting the actual application, operating navigation and timeline controls, and asserting rendered release positions and HTTP requests at the backend boundary. Device lifecycle behavior is outside this seam.
- The review baseline is commit `ffa5dc4d31864f965f5bab54e81063bcc0cdf50a`.
