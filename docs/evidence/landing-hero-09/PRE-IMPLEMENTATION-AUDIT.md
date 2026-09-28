# LANDING-HERO-09: Pre-Implementation Audit

## Problems
- The `aspect-[16/11]` forced on the Reader artificially kept the Player height too small (~250-280px).
- Because the Player was too small, the Playlist items were forced into overflow, displaying a scrollbar (and only one item was fully visible).
- The Left Column (Hero Copy) was dictating a height that wasn't correctly interacting with the Right Column.

## Goal
Make the height of the Player be naturally determined by the Playlist's contents (so all 4 items fit without a scrollbar). Use this natural height across the Grid to balance the Capability Rail. Reduce excessive whitespace at the top of the Hero.
