---
status: accepted
---

# Reconnect Flutter timeline history through each repository's fetched pages

An online Release Timeline refresh may reuse a repository's retained history after its fetched pagination chain reaches previously cached release records. Determine this connection per repository, using stable repository/release identity and request provenance; overlapping publication dates or an overlap from a different repository are insufficient. Keep disconnected cached history hidden from the fresh online timeline. Offline reading of the last saved visible timeline remains a separately accepted behavior.

The cached extension becomes visible only after all relevant Followed Repositories with retained history have passed connection checks; successful fresh results remain visible while waiting. Each user refresh or load-more action performs one coordinated round instead of automatically scanning until an anchor is reached. Store the latest known release content plus necessary pagination provenance, rather than immutable snapshots of every HTTP response.

If a repository is successfully paged to the upstream end without reconnecting to any retained release record, discard that repository's old history and remove its connection barrier. Temporary errors and rate limits do not establish exhaustion and cannot trigger this fallback.

This rule retains the existing bounded-pagination guarantee rather than requiring exhaustive upstream history scans. It does not establish complete publication-time coverage, because GitHub's creation-order pagination differs from the timeline's publication-order display. Other changed/deleted-record cases and changes to the followed set still require explicit handling.
