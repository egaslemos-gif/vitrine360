# LANDING-HERO-11: Playlist Proportion

## Grid Ratio Analysis
- **Old Ratio:** `1.8fr` (Reader) / `1fr` (Playlist) => Playlist was 35.7% of the Player.
- **New Ratio:** `1.7fr` (Reader) / `1fr` (Playlist) => Playlist is 37.0% of the Player (Reader is 63%).
- **Target Constraint:** Playlist should be ~34-36%, max ~38%.

## Absolute Width Improvement
- **Old Hero Container Width:** Max 640px / 42vw.
- **New Hero Container Width:** Max 700px / 46vw.
- By increasing the total max-width of the Player on Desktop, the Playlist's effective 37% share now translates to ~260px (up from ~205px). This significantly improves the legibility of long titles and prevents premature truncation without stealing dominance from the Reader.

## Thumbnail Adjustments
- **Height/Width:** Set to `42px` / `74px` (maintaining ~16:9 ratio).
- **Item Min-Height:** Increased from `52px` to `56px` to offer slightly more breathing room per row while keeping the component strictly compact.
