---
status: accepted
---

# Unknown paths are 404s, and discovery documents list only public pages

An unmatched URL used to be treated as a page that required sign-in. The auth middleware redirected anonymous visitors to the landing page with an Auth Return Target, and that 302 was written before the router could respond 404, so crawlers received the landing page with status 200.

Unmatched paths now fall through to the existing error page with status 404. The auth middleware does not mint an Auth Return Target for them. A return target is kept only when it resolves to a session surface; otherwise sign-in continues to the dashboard. The Browser Launch Link stays a session surface and still round-trips through sign-in.

sitemap.xml and llms.txt are served only when the deployment is indexable, and only for the locale landing pages, using the canonical origin. robots.txt disallows `/open` and advertises that sitemap in the same case. A landing URL that carries an Auth Return Target is noindex, and its canonical is the landing page without that query. This deployment does not publish an agent catalog.

## Considered options

Redirecting every unknown path to sign-in was rejected: it publishes an infinite set of 200 landing URLs. Publishing a sitemap of the whole app was rejected: the dashboard requires a session. Publishing ard.json was rejected: GitPulse has no agent resources to catalog.
