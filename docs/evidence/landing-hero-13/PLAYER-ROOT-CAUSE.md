# PLAYER ROOT CAUSE

## Why the Player Seemed to "Stretch"

The user observed that when reducing the viewport, the Player became disproportionate. The root causes were:

1. **Premature Two-Column Layout:** The Hero grid was breaking into two columns at `lg` (1024px). At this width, the Player container was constrained to `~470px`.
2. **Inner Grid Compression:** Because the internal grid (`Reader | Playlist`) also kicked in at `lg`, it forced the Playlist into a narrow column (~174px). The text wrapped, making the Playlist extremely tall.
3. **Stretch Alignment on Inner Grid:** The internal Player grid used default `align-items: stretch`. Since the Playlist was unnaturally tall due to text wrapping, it forced the Reader's column to match its height.
4. **Mismatch of Ratio & Height:** The Reader had `aspect-[5/4]`. The grid row stretched to match the Playlist, but the `aspect-[5/4]` canvas inside it did not. This left an invisible void in the flex column, causing perceived stretching of the Player shell.
5. **Media Clipping / Black Bars:** The use of `aspect-[5/4]` on the canvas and `object-contain` on the media (which is `16:9`) created inevitable black letterboxing ("zonas negras inexplicadas"), leading to a perception that the Player had an invalid layout.

## Solution

Decoupling the Reader height from the Playlist height by using `items-center` on the Player Grid, shifting the side-by-side breakpoint to `xl` (1280px), and restoring `aspect-video` perfectly aligns the media and prevents artificial height stretching.
