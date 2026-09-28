# LANDING-HERO-09: Responsive QA

## Desktop (1366×768 / 1440×900)
- **Playlist:** All 4 items are perfectly visible simultaneously. The scrollbar is gone because the container is naturally as tall as its content.
- **Top Whitespace:** The padding below the Navbar is perceptibly smaller (40px instead of 48px), creating a tighter, more intentional "respiro".
- **Bottom Whitespace:** The Player and the Left Column perfectly dictate the Hero boundary. The Capability Rail aligns seamlessly with the bottom of the Player, eliminating the empty gap.

## Tablet (768×1024) & Mobile (375×812)
- Without `lg:` rules, the Playlist properly falls back to `aspect-video` for the Reader and standard stacking (`flex-col`) for the Playlist. 
- Left Column internal margin tweaks slightly condense the layout on mobile, improving readability by removing excess scrolling.
