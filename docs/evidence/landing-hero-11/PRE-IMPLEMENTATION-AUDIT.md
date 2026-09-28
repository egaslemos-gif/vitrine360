# LANDING-HERO-11: Pre-Implementation Audit

## Problems
- The Playlist component was previously stretching to match the exact vertical height of the Reader. This artificially dispersed the Playlist content inside the grid, making the spacing between items unnaturally large and "empty."
- The Playlist width was set to 1fr out of 2.8fr (35.7%), but the container's absolute width maxed out at ~570px, leaving only ~205px for the Playlist. This caused premature title truncation.
- The Reader media exhibited clipping on its left edge due to `object-cover`.

## Goal
Decouple the Playlist height from the Reader height so it assumes its natural, compact dimensions, vertically centered beside a dominant, full-height Reader. Prevent image cropping without letterboxing unnecessarily. Increase the effective width of the Player to afford the Playlist slightly more breathing room for text while maintaining a <38% ratio.
