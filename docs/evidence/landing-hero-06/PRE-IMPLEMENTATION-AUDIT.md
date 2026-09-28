# LANDING-HERO-06: Pre-Implementation Audit

## Problem Identified
The `LANDING-HERO-05` update successfully aligned the Hero Copy to the top of the grid. However, because the right-hand Player column is much taller than the text content in the left column, a large empty space now exists below the call-to-action area on the left side of the Hero grid.

## Target Changes
We will introduce a "Product Capability Rail" at the bottom of the Left Column (Copy). This rail will act as a structural and visual extension of the copy, functionally explaining the core loop of the platform (`01 CREATE`, `02 DISTRIBUTE`, `03 CONTROL`) while visually filling the whitespace.

### Design Constraints
1. **Lightweight:** No heavy cards, no strong shadows, no glassmorphism, no gradients, and no giant icons.
2. **Typography-led:** Rely on small numbers, uppercase labels, short descriptions, and subtle vertical separators to integrate seamlessly with the existing design system.
3. **Preservation:** Do not alter existing Hero copy, and do not change the size or dimensions of the Player.

### Action Plan
1. In `src/features/marketing/landing-page.tsx`, directly below the `Offline-first · Multi-screen · Remote control` line.
2. Add a new `div` with `grid grid-cols-3`, `divide-x divide-black/[0.08]`, and a top border `border-t border-black/[0.08]`.
3. Apply top margins (`mt-10 lg:mt-16`) to push it down so it aligns well with the bottom of the Player column.
4. Add the three requested capability steps in a clean, typographic format.
