# LANDING-HERO-11: Responsive QA

## Desktop (1366×768 / 1440×900)
- **Grid Layout:** The Reader naturally stretches, dominating the Left column, while the Playlist is horizontally wider (`37%`) and vertically centered (`align-self: center`).
- **Typography:** The titles inside the Playlist have significantly more breathing room, preventing premature truncation.
- **Images:** The Reader media does not clip; it scales to contain.

## Mobile & Tablet (375x812 - 768x1024)
- When `< 1024px`, the layout gracefully falls back to a 100% width column structure.
- The Reader assumes an `aspect-video` ratio.
- The Playlist drops underneath the Reader, taking 100% width.
- Because `overflow-y-auto` was removed, all 4 items expand naturally downwards without restrictive scrollbars, offering easy touch targets `~52-56px` tall.
