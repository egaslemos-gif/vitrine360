# LANDING-HERO-09: Hero Vertical Balance

## Left Column Tuning
- **Reduced Margins:** Decreased top margins on paragraphs and CTA elements by approximately `12px` total. This brought the natural height of the Left Column to ~345px.
- **Top Whitespace:** Reduced the Hero grid top padding from `lg:pt-12` (48px) to `lg:pt-10` (40px) to decrease the "grande vazio" below the Navbar.

## Grid Synchronization
- **`items-stretch` Strategy:** With the Left Column at ~345px and the Right Column (Player) at ~320px, `items-stretch` safely stretches the Player up by merely `25px`.
- **Capability Rail Alignment:** Since both columns are forced to the exact same 345px height, the `mt-auto` on the Capability Rail perfectly flushes it against the bottom, aligning exactly with the bottom pixel of the Player.
