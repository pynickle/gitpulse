# Watcher Count comes from `subscribers_count`

GitHub's REST repository object exposes `watchers_count`, but its value is identical to
`stargazers_count` — it is the star count, not the watcher count. The real watcher total is
`subscribers_count`. GitPulse therefore reads `subscribers_count` for every Watcher Count and never
displays `watchers_count`. Repository list endpoints (`/user/repos`, `/user/starred`,
`/search/repositories`, `/users/{username}/repos`) omit `subscribers_count`, so repository list cards
carry no watcher stat at all; only the repository Detail Overlay, which loads the single-repository
payload, shows one.
