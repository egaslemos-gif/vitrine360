# LANDING-HERO-03: Responsive QA

## Mobile & Tablet Viewports
- **375px / 390px:** The hero falls back to a single column layout (`grid-cols-1`). Padding is asymmetric (`pt-10 pb-12` vs the old symmetric `py-8`). This brings the eyebrow closer to the Navbar, making it feel intentional and less floaty. Player sits naturally under the text.
- **768px (Tablet):** Triggers `sm:` breakpoint. Padding adjusts to `pt-14 pb-16` (instead of `py-20`). The layout maintains one column. Space between text and player is `gap-12`. Everything remains legible and well-proportioned.

## Desktop Viewports
- **1024px (Small Desktop):** Two-column layout activates (`lg:grid-cols-[...]`). The player takes the right column, text takes the left. Padding is `pt-16 pb-20` (reduced from `py-24`).
- **1280x720 / 1366x768 (Standard Laptops):** The reduced top/bottom padding makes the Hero content fill the viewport nicely without forcing overflow. The top of the next section is often visible, providing a clear hint to scroll. The "floating" sensation in 100vh space is eliminated.
- **1440x900 (Large Screens):** The composition looks balanced. The text isn't excessively stretched.

## Regressions Checked
- **Overflow:** No horizontal scrollbars were introduced.
- **Player Demo:** Remains proportional, responsive, and untampered. Still occupies up to 42vw on large screens.
- **CTA:** Fully accessible, maintains its layout (stacked on mobile, inline on desktop).
- **Navigation:** Navbar stickiness and backdrop blur behave perfectly alongside the new hero spacing.
