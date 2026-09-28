# LANDING-HERO-05: Pre-Implementation Audit

## Problem Identified
Following the changes in `LANDING-HERO-04`, the Player component became taller because the Media now stacks above the Playlist, taking up the full width (maintaining 16:9). The Hero section uses a CSS Grid layout with two columns. Because the Player column grew taller, the `items-center` class on the Grid wrapper forces the Left Column (Hero Copy) to vertically center relative to the Player. This results in the Hero Copy being pushed too far down, creating an awkward, empty white space between the Navbar and the Eyebrow.

## Target Changes
We need to remove `items-center` from the grid wrapper and replace it with `items-start`. This will cause the Copy column and the Player column to both anchor to the top of the grid row, visually aligning the top of the Hero Copy with the top of the Player.

No adjustments to the Player internal dimensions or structure are required. No changes to the runtime or business logic are required.
