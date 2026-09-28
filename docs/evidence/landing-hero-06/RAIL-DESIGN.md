# LANDING-HERO-06: Rail Design

## Concept
The "Capability Rail" is a lightweight typographic component designed to occupy the lower-left quadrant of the Hero grid. It serves two purposes:
1. **Structural:** Fills the empty space created by the height of the Player, creating a balanced, rectangular bounding box for the entire Hero section.
2. **Communicative:** Introduces the core product loop (Create -> Distribute -> Control) immediately, before the user even scrolls to the capabilities section.

## Typographic Decisions
- **Label:** `text-[9px] uppercase tracking-[0.15em] font-bold`. This creates a very technical, precise look.
- **Numbers:** Colored with `text-[var(--color-text-muted)]` to keep them subtle, while the actual action words (`Create`, `Distribute`, `Control`) use `text-[var(--color-primary)]` to draw attention.
- **Value/Noun:** `Content`, `Screens`, `Devices` use `text-[14px] font-semibold tracking-tight text-[#131316]`. This provides strong contrast to the small, spaced-out labels above them.
- **Separators:** `divide-x divide-black/[0.08]` combined with a top border `border-t border-black/[0.08]` anchors the rail to the layout without introducing heavy boxes or shadows. It feels like a natural continuation of the layout grid itself.
