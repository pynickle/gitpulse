---
status: accepted
---

# Make the Timeline Cache Retention Window a Device Choice

Keep the release-timeline history window as a choice of the app installation,
alongside language, appearance, and Followed Repository View, and delete the
account setting and backend capability that used to own it.

The account-owned version was approved earlier (spec questions Q12-B and
Q25-A, and the retention design in #35) and is being reversed deliberately. It
required a network round trip to change how much history this device keeps, so a
reader who was offline — the condition the window exists for — could not change
it. A server that could not be read left the whole device with no window at all,
degrading to "save nothing", and the web client never read the field, so the
server contract had no consumer on the side that shared it.

Extend the device preferences module that ADR 0022 created: rename it from
presentation preferences to device preferences, keep its single JSON document
under the existing file name so an installation keeps its choices without a
migration, and add the window as a fourth field in the same document, the same
controller, and the same serial save queue. The window defaults to 30 whole days
and accepts 1 to 90; selecting an unchanged value writes nothing, and a failed
write keeps the choice for the current run while telling the reader it could not
be remembered. Language, appearance, and the window report that failure; Followed
Repository View stays silent, as before.

Resolve the window before any local write. The startup gate waits for the device
document, and only then may the timeline prune or save. An installation that has
never chosen a window is seeded once from the window its cache ledger last wrote,
so upgrading preserves records that a default would delete; with no ledger entry
it starts at 30. Seeding records the value as this device's choice, so the next
launch needs no seed. A value the document cannot supply is never guessed into a
prune: an unrecoverable read falls back to the default before any write, and a
window that is only half-known never runs.

Applying a window needs no request. The change replays the pages already fetched
and prunes what falls outside the new window, the same path the old flow ran
after server confirmation, minus the network wait. The cache ledger keeps its
`retention_days` column, whose meaning narrows to "the window this installation
last wrote": it seeds a first choice and restores after a restart, and it is not
a second source of truth.

Delete the account field instead of keeping a compatibility bridge: remove
`releaseTimeline.retentionDays` from the shared settings type, its default, its
normalization, and the patch schema, and remove the `timeline-retention`
capability from `GET /api/native/capabilities`. The client connection gate keeps
requiring `provider-discovery` and `release-timeline`. An app built before this
change still demands the removed capability, so it reports that the server needs
an update; a current app connects to an older server that still advertises it.
That one-way break is accepted rather than bridged.

The window stays a reading policy, not an account identity: switching accounts on
one installation keeps the same window, and clearing this account's saved history
leaves the window alone, because clearing removes records and not the choice that
governs them.
