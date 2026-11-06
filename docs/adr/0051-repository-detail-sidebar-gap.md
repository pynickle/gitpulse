# The repository Detail Sidebar carries its resting gap in padding

The repository Detail Sidebar is sticky beside a page-scrolling main column. It used a sticky `top` inset for the gap under the overlay header, and that gap vanished whenever the main column was shorter than the sidebar: an inset only applies while the grid row stays taller than the element, so the row collapsed to the sidebar's height and the sidebar sat flush with the pane top until the panel's data arrived. Loading panels and empty lists both showed the lift.

The gap now lives in the column's padding, so the resting and stuck positions are identical and the grid row's height no longer places the sidebar. The max-height cap grows by the gap so the padding does not shrink the scroll area.

Rejected: keeping the inset and giving the main column a min-height, which only works while the main column is the taller track and ties a layout track to the sidebar's own constant; and re-deriving the cap from `--gitpulse-topbar-height`, because the cap also covers pane padding and buffer, so the tuned value would change.

**Consequences**: The gap and the max-height cap change together. A future sticky variant of the Detail Sidebar that needs a resting offset should carry it in padding rather than in `top`.
