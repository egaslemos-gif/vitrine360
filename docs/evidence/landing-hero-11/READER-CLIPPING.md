# LANDING-HERO-11: Reader Clipping

## Issue
The media surface inside the Reader was previously using `object-cover` coupled with a subtle `scale-[1.02]` animation. Since the Reader width had been artificially squeezed into an almost 1:1 square ratio in the previous step, `object-cover` forced the left and right sides of the 16:9 images to be aggressively cropped ("clipped"), hiding content.

## Solution
- Changed `object-cover` to `object-contain`.
- Applied a `bg-black` background to the wrapping container.
- **Result:** The media now shrinks gracefully to fit entirely within the Reader viewport. Letterboxing is handled naturally by the dark background, preventing any clipping of text or focal points within the image, regardless of the Reader's current stretch ratio.
