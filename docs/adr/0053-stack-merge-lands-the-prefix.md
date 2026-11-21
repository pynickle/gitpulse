# Stack Merge lands the Layers from the first through the chosen one

A Layer cannot land on its own while a Layer below it is still open. GitHub lands a stack from the Trunk upward, and the legacy merge endpoint cannot do it. GitPulse merges a Layer as a Stack Merge: every Layer from the first through the one the reader chose lands as one operation, each with the repository's Merge Method, and every Layer above stays in the Stack. Merging only the chosen Layer was rejected, because that would leave the Layers it depends on unmerged.

**Consequences**: A pull request that is not a Layer keeps its existing merge. A Stack Merge uses GitHub's asynchronous merge, so the result is either landed or placed in the merge queue. The Merge Box lists the Layers that will land and takes one Merge Method for the group. A landing of more than one Layer does not take a commit title or message. A landing of only the first Layer keeps them.
