# List cards fetch Linked Pull Request Count; the Picker fetches rows on open

Issue list cards attach Linked Pull Request Count and at most one routing identity (`owner`, `repository`, `number`). The Linked Pull Request Picker fetches up to 20 rows only when it opens. Lists do not prefetch Picker rows, which keeps Search and Notification Subject Enrichment cheap.

Count 1 with a complete identity opens the Picker when Single Linked Pull Request Preview is on, the default, so the reader sees that row before opening it. Turning the preview off navigates straight to the pull request. Count greater than 1, and Count 1 without a complete identity, always open the Picker.
