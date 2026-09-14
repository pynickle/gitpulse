# Narrow Dashboard Home is a top bar plus Dashboard Menu, not a bottom bar

On viewports at or below 860px, Dashboard Home hides the layout Navbar, Activity Bar rail, persistent Tab Sidebar, widgets, and floating refresh control. The list uses the first screen. Chrome is one top bar (menu, current tab title, filter when the tab has filters, refresh, avatar) and a left overlay named Dashboard Menu.

The Dashboard Menu lists the six built-in tabs above the existing Tab Sidebar tree. Account actions live in an anchored menu on the avatar, not in the Dashboard Menu. The overlay does not push the list, does not use edge-swipe, and closes on select, scrim, Escape, or a second press of the menu button.

A bottom bar was rejected: six built-in tabs do not fit five slots without demoting Release Timeline, and a bottom bar collides with the existing refresh control. A persistent top icon rail was rejected: six 44px icons overflow a 375px width and recreate the Activity Bar sideways. Those alternatives stay available if Overlay work later changes the product shape.
