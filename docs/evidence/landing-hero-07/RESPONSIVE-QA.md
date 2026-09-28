# LANDING-HERO-07: Responsive QA

## Desktop (1280×720, 1366×768, 1440×900, 1536×864)
- **Side-by-Side Composition:** The `Media Reader` and `Playlist` sit perfectly side-by-side inside the Player card. 
- **Proportions:** The `Reader` dominates visual space taking approximately 72% of the width. The `aspect-video` scale ensures the image isn't distorted or padded with empty whitespace.
- **Card Height:** The overall height of the Player Demo is vastly reduced because it no longer stacks the Playlist vertically. It now exactly matches the height of the 16:9 Reader + the Header height. 
- **Scrolling Playlist:** The `Playlist` adapts perfectly to the height of the Reader. Any overflowing items trigger internal scrolling without breaking the grid boundary.
- **Hero Grid Balance:** The Hero section as a whole is dramatically shorter and more balanced. The empty space at the bottom of the Left Column that the Capability Rail previously had to stretch far down to cover is now naturally eliminated. The baseline of the Capability Rail aligns beautifully with the bottom of the new, shorter Player.

## Mobile (375×812, 390×844) & Tablet (768×1024)
- **Fallback to Stack:** Since `< 1024px` applies `flex-col`, the Player reverts to a vertical stack.
- **Width Usage:** The `Playlist` takes full width below the `Reader`, matching standard mobile UI expectations.
- **Overflow Avoided:** Because absolute positioning was explicitly scoped to desktop (`lg:absolute lg:inset-0`), the mobile playlist flows normally in the document, avoiding overlapping content bugs.
