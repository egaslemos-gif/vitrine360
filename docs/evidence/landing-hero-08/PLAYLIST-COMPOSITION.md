# LANDING-HERO-08: Playlist Composition

## Spacing & Sizing Updates
- **Item Height:** Increased to `lg:min-h-[52px]` allowing a much more comfortable click target.
- **Thumbnails:** Scaled to `lg:h-[34px] lg:w-[60px]`, maintaining the 16:9 ratio but offering more visual real estate.
- **Typography:** The item title font sizes were bumped to `lg:text-[14px]`.
- **Gaps & Padding:** Internal padding (`lg:p-4`) and gaps (`lg:gap-4`) were increased to give the UI breathing room, eliminating the previous "cramped widget" feel.

## The Reader Aspect Ratio Trick
- To fit the slightly taller Playlist elements comfortably (without overflowing and triggering a scrollbar), the `Media Reader` must be given a slight vertical boost.
- Changed the reader's height rule from `aspect-video` (16:9) to `lg:aspect-[16/11]` on desktop. 
- This preserves the cinematic horizontal feel but provides just enough extra vertical pixels to accommodate the four `52px` items + padding + headers seamlessly. The scrollbar only appears if absolutely necessary, but naturally stays hidden.
