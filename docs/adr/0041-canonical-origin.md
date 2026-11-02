---
status: accepted
---

# A deployment's canonical origin is configuration, and production refuses to start without one

Search results and link previews were sent to a host this project no longer serves, because `site.url` fell back to that host at build time and the fallback outranked the request host. Putting one public host in source would hand every other deployment that same problem.

The canonical origin is `NUXT_SITE_URL`, read when the server process starts. Production exits when it is missing or is not an absolute http(s) origin with no path, query, or hash. Development warns and continues. The image build does not need the variable, and `NUXT_PUBLIC_SITE_URL` is not a second name. Locale alternates use the same origin.

## Considered options

The request host was rejected: a deployment reachable on more than one host would publish more than one canonical. A default host in source was rejected: self-hosted deployments would advertise someone else's origin.
