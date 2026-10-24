---
status: accepted
---

# Unify Flutter Device Presentation Preferences

Flutter's language, appearance, and Followed Repository View belong to one app
installation, shared across its accounts and backends and retained after
sign-out. Keep this scope instead of adopting the web client's account-owned
Followed Repository View: the same account may use different presentation
choices on different installations.

Extend the existing PresentationPreferences model, controller, JSON document,
and serial save queue to own all three choices. Replace the Followed Repository
View's separate state and text-file writer; a read-only projection may remain
for its consumers. One owner prevents the preferences from acquiring different
restore and write-ordering rules without introducing a general settings
framework.

Keep the existing controls in place: language and appearance in Settings and
the connection-page dialog, and Followed Repository View in the followed-list
controls. A failed save preserves the current choice for this run. Followed
Repository View save failures remain silent; language and appearance retain
their existing failure feedback. Sharing persistence must not turn a view-only
save failure into a language or appearance warning.

Do not add backward compatibility for the old view store: do not read, migrate,
or dual-write followed_repository_view.txt. Retain the existing language and
appearance fields in presentation_preferences.json and add the view choice
there. A missing view field starts at Compact View, even when the old text file
contains Detailed View.

Reuse the existing startup ordering: surfaces show defaults while the local
read is pending, and changes wait for that read before updating the latest
state. Saved values cannot overwrite a newer choice, and changes to different
fields must not overwrite each other. Invalid fields fall back individually;
malformed JSON falls back to system language, system appearance, and Compact
View without a read-error prompt. This accepts a shared corruption boundary
for the three preferences in exchange for one persistence path.

Keep the existing retry behavior. Each actual preference change queues the
full current snapshot, and a failed write does not prevent subsequent saves.
The next actual change to any of the three preferences retries persistence of
the latest choices. Selecting an unchanged value does not retry; add neither
automatic retries nor a retry control.
