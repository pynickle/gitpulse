# Dashboard Routing Patterns

This document explains when to use different routing patterns for detail pages in the dashboard.

## Pattern Categories

### 1. Separate Entry Type (Standalone Page)

**When to use:** When the sub-view has:
- Different top-level affordances (toolbar, actions, layout)
- Distinct back-button behavior (should go to parent, not browser back)
- Separate data loading requirements
- Different permission/access patterns

**Examples:**
- **PR Review** (`?prReview=owner/repo/123`) — Separate from PR overview
  - Has diff-specific toolbar (comment modes, expand/collapse)
  - Back button should return to PR overview, not previous page
  - Uses `pull-request-review` entry type

**Implementation:**
- Create dedicated query param (e.g., `prReview`)
- Add entry type to `PageType` in `useNavigationHistory.ts`
- Add dedicated `navigate*` function
- Handle separately in watch effects

### 2. Route Parameter (Sub-navigation)

**When to use:** When the sub-view:
- Shares chrome/context with parent page
- Is compositional (part of exploring the parent resource)
- Doesn't need separate back-button behavior
- Uses the same permissions as parent

**Examples:**
- **File Browsing** (`?repo=owner/repo&path=src/main.ts&branch=main`)
  - Path is a parameter within repo exploration
  - Shares repo context and chrome
  - Back button behavior handled by browser

**Implementation:**
- Use additional query params alongside base param
- Detection via composite condition (e.g., `activeRepoTarget && route.query.path`)
- Share entry type with base view or use specialized type (`file`)

### 3. Compositional Parameters (Addressing Modes)

**When to use:** When there are multiple ways to identify the same resource:
- Different ID types (numeric ID vs semantic slug/tag)
- Format variations that resolve to same content

**Examples:**
- **Release by ID vs Tag** (`?release=owner/repo/123` OR `?release=owner/repo&releaseTag=v1.0.0`)
  - Both resolve to the same release resource
  - Tag is human-readable, ID is canonical
  - Share `release` entry type

**Implementation:**
- Primary param contains common structure
- Optional secondary param provides alternative identifier
- Parsing logic handles both forms

## Current Implementation

| Page | Pattern | Query Params | Entry Type | Rationale |
|------|---------|--------------|------------|-----------|
| Issue | Standalone | `issue=owner/repo/123` | `issue` | Top-level detail page |
| PR Overview | Standalone | `pr=owner/repo/123` | `pull-request` | Top-level detail page |
| PR Review | Standalone | `prReview=owner/repo/123` | `pull-request-review` | Different affordances than PR overview |
| Discussion | Standalone | `discussion=owner/repo/123` | `discussion` | Top-level detail page |
| Release | Compositional | `release=owner/repo[/id]&releaseTag=tag` | `release` | Multiple addressing modes |
| Repository | Standalone | `repo=owner/repo` | `repository` | Top-level detail page |
| File Browse | Route Parameter | `repo=owner/repo&path=...&branch=...` | `file` | Sub-navigation within repo |

## Guidelines

### Choosing the Right Pattern

1. **Start with Route Parameter** if the sub-view is exploratory navigation within a parent resource.
2. **Upgrade to Separate Entry Type** if:
   - You need different back-button behavior
   - The sub-view has its own toolbar/actions
   - Data loading requirements differ significantly
3. **Use Compositional Parameters** only for multiple identifiers of the same resource.

### Consistency Rules

- **Detection**: Separate entry types should check dedicated target (e.g., `activePRReviewTarget.value`), not composite conditions
- **Navigation**: Each standalone page type needs its own `navigate*` function
- **Canonicalization**: Conflicting detail params should be resolved in priority order
- **History Management**: Use `replaceWithEntry()` when transitioning between types, not direct mutation

## Why PR-Review is Separate but File Browsing is Not

**PR Review** is a separate entry type because:
- Has distinct diff-viewing UI with comment threads
- Different actions (approve, request changes, submit review)
- Back button should return to PR overview page
- Can be bookmarked as distinct from PR overview

**File Browsing** is a route parameter because:
- Shares repository context and chrome
- Path is compositional (navigating a tree structure)
- Back button can use browser history (browsing is stateless)
- Natural for path to be a parameter, not a separate resource type

## Future Considerations

If you're adding a new sub-page, ask:
1. Does closing this view return to a specific parent page? → **Separate Entry Type**
2. Is this exploring a dimension of the parent resource? → **Route Parameter**
3. Is this an alternative way to identify the same resource? → **Compositional Parameters**

When in doubt, start with Route Parameter (simpler) and refactor to Separate Entry Type if back-button or navigation requirements become complex.
