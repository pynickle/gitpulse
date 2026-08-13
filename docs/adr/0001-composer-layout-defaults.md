# Conversation and review composers use different default layouts

Conversation Composers seed from Conversation Composer Default Layout (Split). Review Inline Composers seed from Review Inline Composer Default Layout (Tabbed). The Review Submit Composer is always Tabbed Layout and ignores settings. Settings seed the next open only; in-session layout toggles are not written back.

Only an expanded sticky Conversation Composer in Split Layout bleeds wider than the main column (covers the detail sidebar, 1.5rem inset from the overlay edge). In-thread discussion replies and both review composers never bleed.
