# LANDING-HERO-06: Responsive QA

## Desktop QA (1280×720, 1366×768, 1440×900, 1536×864)
- **Top Alignment:** The Eyebrow remains top-aligned with the top edge of the Player.
- **Whitespace Resolution:** The previously empty void at the bottom of the Left Column is now purposefully filled by the Capability Rail.
- **Visual Weight:** The Rail correctly mimics a "footer" or "metadata bar" for the Hero Copy. The light dividers (`divide-black/[0.08]`) and typography scale beautifully without stealing attention from the giant Player or the CTA button.
- **Bottom Alignment:** The Rail extends downwards, bridging the visual gap and creating a strong horizontal baseline roughly matching the height of the Player.

## Mobile & Tablet QA (375×812, 390×844, 768×1024)
- **Single Column Flow:** The Rail renders below the CTA and proof points.
- **Proportions:** Due to its grid layout (`grid-cols-3`), it divides the mobile width evenly into three sections. This ensures it looks like a cohesive, technical stats-bar even on small screens.
- **Padding/Margins:** It features reduced top-margins (`mt-12` and `sm:mt-16`) compared to desktop (`lg:mt-[4.5rem]`) to keep the vertical density compact when the Player flows below it. No horizontal scrolling or overflow is introduced.
