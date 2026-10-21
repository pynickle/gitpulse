# The Release Drawer has its own Repository Release List

The fullscreen releases page remains the Repository Release List reached from a repository. Inside a Release Drawer the same list uses a presentation made for that drawer. The first time the drawer shows this list during an opening, it is page 1, newest first; it does not try to place the Entry Release on a calculated page. Page and filter stay in place while that drawer remains open. From the list or from another release, one step returns to the Entry Release that was open when the drawer opened.

In Flutter, release details already loaded during an opening remain available when returning to the Entry Release or revisiting another release, including across repositories. Returning shows those details immediately without another request. Closing the drawer releases the retained details; reopening starts a fresh load.
