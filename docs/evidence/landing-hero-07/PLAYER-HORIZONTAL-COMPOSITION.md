# LANDING-HERO-07: Player Horizontal Composition

## Layout Architecture

To achieve the side-by-side design on desktop without causing the `Media Viewport` to stretch and create empty space, we rely on CSS Grid combined with absolute positioning.

### The Grid
- **Desktop Grid:** `lg:grid lg:grid-cols-[minmax(0,2.15fr)_minmax(210px,0.85fr)]`
- This assigns roughly 72% width to the Reader and 28% to the Playlist.
- **Alignment:** Grid columns implicitly stretch (`align-items: stretch`).

### The Height Dictator
- The `Media Viewport` (Reader) is given the `aspect-video` class. Because its width is constrained by the grid column (`2.15fr`), its height is perfectly calculated to be a 16:9 box.
- By ensuring that the Reader is the *only* element with an intrinsic vertical height requirement, the overall Grid Row adopts the exact height of the Reader.

### The Playlist Trick
- If the Playlist simply flowed naturally, its content (the list of 4 items + header + footer) might be taller than the Reader, forcing the entire row to stretch, which in turn causes the Reader column to have white space.
- **Solution:** Wrap the Playlist in a `relative` container that spans the height (`h-full`). Then, place the actual Playlist content inside an `absolute inset-0` container. 
- Because the content is `absolute`, it escapes the normal flow and contributes **zero** intrinsic height to the grid row.
- The grid row's height is purely dictated by the 16:9 Media Reader.
- The `absolute` Playlist container adopts the exact height of the grid row, and its internal `ul` uses `overflow-y-auto` to allow scrolling if the content exceeds this constrained height.
