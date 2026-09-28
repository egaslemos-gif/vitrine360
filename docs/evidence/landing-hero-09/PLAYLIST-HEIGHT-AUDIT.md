# LANDING-HERO-09: Playlist Height Audit

## Desktop Playlist Height
- **Items:** 4 items × `52px` = 208px.
- **Header & Note:** `16px` + `28px` = 44px.
- **Padding & Gaps:** `24px` + `18px` = 42px.
- **Total Natural Height:** ~314px.

## Removal of Restrictions
- Removed `overflow-y-auto` from the `ul` element on Desktop.
- Removed `aspect-[16/11]` from the Reader `.ui-player-canvas`.
- Added `h-full` to the Reader.

By un-restricting the height, the Playlist now fully dictates the minimal height of the entire Player row. It guarantees all 4 items fit simultaneously without scrolling. If the grid row becomes taller (due to the Left Column), `lg:justify-center` vertically centers the Playlist cleanly.
