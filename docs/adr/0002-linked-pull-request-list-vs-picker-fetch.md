# List cards fetch Linked Pull Request Count; the Picker fetches rows on open

Issue list cards attach Linked Pull Request Count and at most one routing identity (`owner`, `repository`, `number`) so Count 1 can open that pull request immediately. The Linked Pull Request Picker fetches up to 20 rows only when it opens. Lists do not prefetch Picker rows. This keeps Search and Notification Subject Enrichment cheap while Count 1 (`Fixes #n`) still navigates without a modal.
