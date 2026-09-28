# LANDING-HERO-08: Responsive QA

## Desktop QA (1280×720, 1366×768, 1440×900, 1536×864)
- **Playlist Visibility:** All 4 items are comfortably visible without internal scrollbars. 
- **Playlist Aesthetics:** Increased height (`52px`) and spacing makes the Playlist feel like a proper side-panel rather than a cramped widget.
- **Hero Column Balance:** The Hero Copy remains top-aligned, but the Capability Rail anchors flawlessly to the bottom. The resulting vertical density across the entire Hero section is beautifully balanced, transmitting "space and sophistication" instead of "emptiness."

## Mobile QA (375×812, 390×844) & Tablet QA (768×1024)
- **Playlist Stack:** Returns to vertical flow. Absolute positioning (`inset-0`) and forced scrollbars are disabled on these breakpoints.
- **Aspect Ratio:** The Player Canvas uses standard `aspect-video` on mobile, keeping it compact.
- **Capability Rail:** `lg:mt-auto` drops out on smaller screens, reverting to `mt-12 sm:mt-16` so it flows naturally in a single column without breaking flex constraints.
- **Overall Mobile Fit:** The Playlist items remain comfortable to tap without stretching the page too heavily.
