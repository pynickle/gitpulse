# Dashboard Home uses 860px as its only narrow breakpoint

Dashboard Home already shares an 860px cutoff with the Filter Modal, Release Drawer, and composer bleed. The layout stack at 768px is the outlier: between 769px and 860px the shell is still a four-column desktop while filters have already gone mobile. Dashboard Home now uses `max-width: 860px` as the single switch between wide chrome and narrow chrome.

768px is not kept as a second layout breakpoint. A `pointer: coarse` override is not added, so a landscape phone wider than 860px (for example ~932px) keeps the wide Activity Bar and Tab Sidebar.
