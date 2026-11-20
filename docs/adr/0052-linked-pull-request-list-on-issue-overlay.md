# An Issue's Detail Overlay lists its Linked Pull Requests

An Issue's Detail Overlay renders its Linked Pull Requests as a band inside its header, between the metadata row and the description, in the same order and grouping the Linked Pull Request Picker uses. The band shows the first five rows and reveals the rest in place, so an Issue with one or two linked pull requests costs the page one row, while an Issue with twenty never pushes the conversation off the first screen. Count 0 renders nothing.

The band sits in the main column rather than the Detail Sidebar: below 1025px the sidebar is a bottom sheet a reader has to open, and a row's title needs the main column's width.

List cards keep Linked Pull Request Count and the Picker ([ADR 0002](0002-linked-pull-request-list-vs-picker-fetch.md)). The Picker opens one pull request without opening the Issue; the band answers "what is attached to this Issue". Neither replaces the other.

Further pages come from the GraphQL connection's cursor, not the page number the Issue timeline uses: a page number would cost one upstream request for every skipped page.
