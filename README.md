# GitPulse — GitHub Work Dashboard

Track notifications, issues, pull requests, and repositories from one focused workspace. No tab-switching, no noise.

![AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue) ![Nuxt 4](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt) ![Bun](https://img.shields.io/badge/Bun-000000?logo=bun)

---

## Features

### 📬 Notifications

Grouped by reason — `mention`, `review_requested`, `ci_activity`, `security_alert`, `assign`, `state_change`, `subscribed` and more. Unread items have a blue indicator. Click **Mark as read** to dismiss, or let the 60-second auto-refresh catch new ones without reloading the page.

### 🎯 Issues & Pull Requests

Search-backed lists with quick filters (open / closed / merged). Click any row to open a **slide-over detail panel** showing the full timeline, labels, assignees, and action buttons — no page navigation needed.

### ✨ Custom Tabs

Create unlimited tabs backed by **real GitHub search queries**. Paste any GitHub search qualifier into the tab editor — it just works. Drag-and-drop to reorder, group tabs into named folders.

### 🖨 Markdown + Diagrams

Comments render with rich Markdown, syntax-highlighted code blocks, and **Mermaid diagrams** — sequence charts, flowcharts, Gantt — inline where they belong.

### 🌐 i18n

Built-in English and Simplified Chinese, auto-detected from your browser.

### 🌙 Dark Mode

Adaptive dark mode styling keeps the dashboard comfortable in low-light environments and aligned with the system theme.

### 📂 Repositories

Paginated list of your repos with quick links to each. A fast way to jump to a project without leaving the dashboard.

---

## Why GitPulse?

GitHub's own interface has you bouncing between tabs, pages, and repos to stay on top of everything. GitPulse brings it all into **one single-page workspace**:

|                              | GitHub.com                            | GitPulse                                |
| ---------------------------- | ------------------------------------- | --------------------------------------- |
| Notifications + Issues + PRs | Separate pages, lots of back/forth    | One dashboard, four tabs                |
| Custom saved searches        | Bookmarks or URL hacks                | Built-in tab manager with drag-and-drop |
| Interface focus              | Nav bar, project panel, sidebar noise | Only the GitHub activity you care about |

---

## Quick Start

Runtime uses **Bun**. Start the dev server:

```bash
bun install
bun run dev
```

Open the URL shown in terminal and paste your GitHub token on the landing page.

> To get a token, run `gh auth token` — the token inherits the permissions you granted to the GitHub CLI, which typically includes organization-level access.

---

## Try It Online

Visit **[gitpulse.euphony.ink](https://gitpulse.euphony.ink)** — an official demo running in non-personal mode. Paste a GitHub token or sign in with OAuth to try the dashboard instantly.

---

## Self-hosting

GitPulse has two deployment modes, controlled by environment variables. At least one must be enabled, or the app refuses to start.

### Non-personal Mode (multi-user)

Users sign in by pasting a GitHub token or via GitHub OAuth. Suitable for teams or hosted deployments.

| Environment Variable              | Required | Default | Description                            |
| --------------------------------- | -------- | ------- | -------------------------------------- |
| `NUXT_SESSION_PASSWORD`           | **Yes**  | —       | 32-byte hex key for session encryption |
| `NUXT_AUTH_PAT_ENABLED`           | No       | `true`  | Allow token-based login                |
| `NUXT_AUTH_GITHUB_OAUTH_ENABLED`  | No       | —       | Allow OAuth login                      |
| `NUXT_OAUTH_GITHUB_CLIENT_ID`     | If OAuth | —       | GitHub OAuth app client ID             |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | If OAuth | —       | GitHub OAuth app secret                |

### Personal Mode (single-user, self-hosted)

A password-gated vault with a pre-configured token. On each new browser you see a lock screen; optionally tick "Remember this device" to stay logged in.

| Environment Variable              | Required | Default | Description                              |
| --------------------------------- | -------- | ------- | ---------------------------------------- |
| `NUXT_AUTH_PERSONAL_MODE_ENABLED` | **Yes**  | —       | Enable personal mode                     |
| `NUXT_PERSONAL_TOKEN`             | **Yes**  | —       | GitHub token baked into the server       |
| `NUXT_PERSONAL_MODE_PASSWORD`     | **Yes**  | —       | Lock-screen password                     |
| `NUXT_PERSONAL_COOKIE_SECRET`     | **Yes**  | —       | Secret for signing "remember me" cookies |

---

## FAQ

### Does GitPulse store my token?

No. Your token is kept in an encrypted server session cookie — it never touches a database. When you close the browser, the session ends.

### How do I log out?

Click your avatar in the left activity bar → **Logout**. Your session cookie is cleared.

---

## License

GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).
