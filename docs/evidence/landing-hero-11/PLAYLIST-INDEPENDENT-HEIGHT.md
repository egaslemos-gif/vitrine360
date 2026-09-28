# LANDING-HERO-11: Playlist Independent Height

## Issue
Previously, the Playlist component wrapper `aside` was constrained by `lg:h-full` and its inner `div` possessed flex behaviors designed to fill that container, causing the Playlist to artificially "stretch" when the Left Column dictated a larger Hero row height.

## Implementation Details
- Removed `lg:h-full` from the `aside` (the Playlist wrapper) in `InteractivePlayerDemo`.
- Applied `lg:self-center` instead.
- **Result:** The Reader continues to stretch naturally (`items-stretch` from the grid), but the Playlist `aside` evaluates its height solely from its own compact content (`header + 4 items + gaps + demo note`), centering itself vertically alongside the larger Reader.
- The Demo Note was styled with `border-t` and strict, small top padding, cleanly resolving the component without forced empty gaps.
