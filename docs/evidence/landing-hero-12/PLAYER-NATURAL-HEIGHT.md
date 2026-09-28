# LANDING-HERO-12: Player Natural Height

With the Hero grid no longer stretching the Player, the Player's height must be determined intrinsically by its content (Reader + Playlist).

To ensure the Reader maintains dominance and a cohesive visual presence without artificially shrinking to a narrow band, we replaced its `h-full` and `aspect-auto` with a fixed, elegant aspect ratio: `lg:aspect-[5/4]`.

## Height Mechanics
- Reader width is typically ~395px on a 1366px screen.
- Reader natural height = `395 * (4/5) = ~316px`.
- Playlist natural height (Header + 4 Items + Note) = `~314px`.
- The Reader is marginally taller than the Playlist, making it the dominant element that dictates the final height of the `PlayerCard`.
- The Player wrapper dynamically calculates this height and naturally occupies exactly what it needs, finishing well before the Left Column.
