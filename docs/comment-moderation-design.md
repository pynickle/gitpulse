# Comment moderation design exploration

Status: interaction design confirmed through all eight decisions. The research note retains the API verification limits, including GraphQL review deletion. This document records the design; no application implementation or accepted ADR is included.

## Scope and evidence

GitHub API and permission findings are recorded in [the research note](research/github-comment-moderation.md). This exploration covers existing web comment surfaces: Issue and PR conversation comments, PR review summaries, individual review comments and replies in the timeline and PR Review Workspace, commit comments in the PR timeline, and Discussion comments, replies and accepted answers.

The Flutter boundary remains the Release Timeline, repository and release surfaces ([ADR 0015](adr/0015-flutter-release-timeline-client-boundary.md)); it currently has no corresponding comment surfaces.

Issue/PR descriptions are subject bodies, not comments. Resolving a review thread, dismissing a review, and deleting a pending review are separate operations from moderating an individual comment.

## Confirmed decisions

- Use candidate A: a consistent header overflow menu, with a short action sheet on narrow viewports.
- Keep the comment action trigger visible without requiring hover when permitted actions exist; omit an empty menu.
- Every Hide operation requires an explicit reason selection; do not preselect a reason.
- The Hide reason picker is a modal matching the existing web app's editor visual style. Reuse the established overlay, spacing, title, option and button treatments; do not introduce a separate visual design. Selecting a reason does not submit; the Hide button submits the choice. The picker is the Issue Edit Type modal: overlay, titled header with a close control, scrollable option list and footer. Each classifier carries its own colour bar; the chosen row marks itself the same way the issue-type row does (bar at full strength, accent label, check), so the picker cannot be confused with a new dialog the app does not otherwise have.
- Hiding a Discussion parent collapses only the targeted comment's body. Keep its replies visible; each reply respects its own hidden status independently.
- Delete uses a simple second confirmation with Cancel and Delete. Do not include author details, a body preview or typed confirmation. Use wording appropriate to the actual target, which is always a comment: a review body is never a Delete target.
- Preserve the existing header of a hidden comment and replace the body with a compact notice containing the hidden reason and Show content. Expansion only reveals the body for the current reader; it does not change the shared hidden status. The notice sits where the body was rather than in the header: comment headers are already one or two lines, and the reason reads better next to the masked content. The same notice presents the reason and one text control that toggles in both directions (Show content and Hide content), so a reader can fold the body back without leaving.
- Offer Unhide as a separate permitted menu action. Execute it without another confirmation and restore the ordinary comment presentation after success.

The Discussion reply choice is confirmed by the user. A [firsthand GitHub Community report from 2023](https://github.com/orgs/community/discussions/59323) describes hiding only the selected parent while replies remain visible. This historical evidence and a current static HTML inspection informed the recommendation; the product choice does not depend on claiming browser verification of GitHub's current UI. See the evidence limits in the research note.

## Vocabulary

- Hide: GitHub comment minimization, shared with other readers and reversible through unminimization.
- Show content: expand the hidden comment locally for reading; this does not unminimize it on GitHub.
- Unhide: remove GitHub minimization, requiring the relevant permission.
- Delete: remove the GitHub comment; there is no restore-comment operation to present as Undo.

The shared hidden status, independent replies and the distinction between reading a hidden comment and unhiding it are recorded in `GLOSSARY.md`. Presentation choices remain separate from those terms.

## Existing integration points

- `TimelineCommentCard.vue` and `TimelineCardHeader.vue` serve Issue and ordinary PR comments. The header currently has no action slot.
- `PRTimelineReviewCard.vue` renders review bodies and individual comments separately. `PRReviewDiffReviewThreads.vue` renders workspace comments and replies.
- `DiscussionCommentCard.vue`, `DiscussionReplyList.vue`, and `DiscussionAnswerCard.vue` render different presentations of Discussion comments.
- Issue/PR normalization retains numeric IDs but does not expose explicit node IDs, moderation capabilities or minimized state. Discussion normalization retains node IDs but lacks moderation capabilities and state.
- Commit comments are normalized with the visual kind `review-comment`. Dispatching new mutations by that kind would choose the wrong API. Preserve the actual GitHub object type.
- The same comment can appear in both PR timeline/workspace, or Discussion conversation/answer presentations; a successful change needs to update each presentation.

## Candidate A: header overflow menu

```text
alice · 2 hours ago                           ⋯
Comment body
```

The menu offers Hide or Unhide when available, and Delete as a separated destructive item. A wide viewport uses an anchored menu; a narrow viewport can use a short action sheet. The same header placement applies to an individual reply and individual inline review comment. An entire review has its own header action scope.

Advantages: familiar placement, consistent across comment types, minimal reading noise. Cost: one extra step and lower discoverability. Selected by the user for the current reading-oriented surfaces. Keep a reachable trigger on touch and keyboard; do not depend exclusively on hover or long press.

## Candidate B: visible footer actions

```text
alice · 2 hours ago
Comment body
👍 3       Reply                  Hide  Delete
```

Place permitted moderation actions alongside existing footer actions. Hide opens a reason picker; Delete opens confirmation. On narrow viewports the actions may wrap to a second line.

Advantages: visible and fast to learn, useful for frequent moderation. Cost: more controls on every comment, crowded review threads, destructive actions close to routine reading actions. This option changes comment density more substantially than A.

## Candidate C: focused comment panel

```text
Conversation                 | alice · 2 hours ago
  selected comment     ⋯     | Comment preview
                             | Hide reason
                             | [Hide]       [Delete]
```

An individual comment's menu opens a side panel on a wide viewport and a sheet on a narrow viewport. The panel contains a contextual preview and the permitted actions. It handles one comment at a time; no batch moderation is proposed.

Advantages: a clearer target for long comments and room for reason selection. Cost: another surface, space competing with Detail Sidebar and review panes, and more navigation for a small set of operations. Prefer only if moderation is a frequent primary activity.

## Shared behavior

- Determine actions from the actual GitHub object and current token's capabilities. Neither author association nor a repository role alone is sufficient. A review body is its own target: REST deletes a pending review only, and this client never creates one, so a review is never offered Delete and the server refuses that request; do not route a review body through ordinary-comment deletion. (Revised 2026-11-11: the earlier note left the review's GraphQL delete capability open; the product rule is now a categorical no.)
- Preserve a hidden comment's existing header, with a compact reason and Show content notice replacing its body. Reading its content and Unhide are separate actions; Unhide requires no additional confirmation.
- Hidden status and reason must already be respected on initial render, including comments hidden on GitHub rather than through GitPulse.
- Hide offers GitHub's supported classifiers. Confirmed: require a fresh explicit choice for each Hide operation, with no preselected reason.
- Delete uses the confirmed simple second confirmation: no author details, body preview or typed confirmation. No fake Undo. Only remove the rendered target after upstream success; retain content and show an actionable error on failure.
- Disallow repeated submission while the action is pending. A permission failure refreshes capabilities instead of pretending success.
- A hidden Discussion parent remains identifiable and its replies remain visible, as confirmed. GitHub's `deleteDiscussionComment` wipes a comment when it has replies, rather than deleting the reply tree; retain those replies and refresh the parent and accepted-answer presentation from the actual GitHub result.
- Review-thread Resolve remains distinct from Hide; review summaries and the comments nested under them keep distinct operation targets.

## First decision round

1. Header overflow menu: A selected.
2. Replies beneath a hidden Discussion parent: preserve the replies; accepted after reviewing GitHub behavior evidence.
3. Explicit reason for every Hide operation: accepted, with no preselected reason.

No ADR has been created: these interface choices are straightforward to reverse and do not meet the ADR criteria.

## Second decision round

4. Menu discoverability: accepted; keep the permitted trigger visible without hover.
5. Hide flow: use a reason modal matching the current web app's editor dialogs; accepted with this style requirement.
6. Delete flow: simple second confirmation only; author details and body preview explicitly rejected.

## Final decision round

7. Hidden-comment presentation: accepted; preserve the header, show the reason and Show content, and expand the body locally without changing shared hidden status.
8. Unhide flow: accepted; apply without another confirmation and restore the ordinary comment presentation after success.

All eight interaction decisions are settled. No further UI decision is pending from this interview. The API verification limits remain explicit in the research note and must not be replaced with assumed permissions or deletion semantics.

## Implementation notes from the UI rebuild

The shipped controls were rebuilt once the first implementation was readable in the browser. These notes record what the rebuild settled; they refine the decisions above without changing them.

- The comment overflow menu is an anchored popover, not a page-level modal. It takes focus (the modal lifecycle traps Tab, closes on Escape and returns focus to its trigger) but it does not register an app modal, so the floating Markdown Composer at the bottom of the detail overlay stays visible while the menu is open. The reason picker and the delete confirmation reuse the same lifecycle without registering a modal either: they sit under the picker's own scrim, which already covers the composer.
- The hidden notice is one line of app-native pieces: a light tag stating Hidden and the reason, followed by a text-only control. The control paints no border and no background in either state; only its label and chevron answer the pointer, so the notice never looks like a second button.
- The delete confirmation reuses the picker's panel (title, close control, footer) with the filled danger answer, so the two moderation steps share one dialog geometry. The pending spinner inside the submit button is the picker's own filled-button layout, which is what keeps its distance from the label identical to the Issue Edit Type save button.
- A refused Unhide keeps the menu open and renders the failure next to the menu items; refusals inside a dialog render in the dialog. A failed action never hides the comment or fakes success.

## Documentation discrepancy found during inspection

`.agents/skills/nuxt-gitpulse/SKILL.md` points to `.nuxt/skill-hub/nuxt-gitpulse/SKILL.md`, which is absent in this checkout. The generated router is present at `.codex/skills/nuxt-gitpulse/SKILL.md` and was used for the read-only investigation. No application code or adjacent skill files were changed.
