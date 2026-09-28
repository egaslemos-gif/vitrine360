# LANDING-HERO-07: Pre-Implementation Audit

## Problem Identified
The `LANDING-HERO-06` addition of the Capability Rail looks great, but the Player Demo on desktop is currently stacked vertically (`Header` -> `Media Viewport` -> `Playlist`). This causes the Player to be extremely tall. The user wants the Player to be more compact by moving the `Playlist` alongside the `Media Viewport` (side-by-side) on desktop.

## Layout Constraints
1. **Desktop Side-by-Side:** `grid-template-columns: minmax(0, 2.15fr) minmax(210px, 0.85fr)` (approx. 72% Reader / 28% Playlist).
2. **Height Dependency:** The overall height of the Player *must* be strictly determined by the `Media Viewport` maintaining its `16:9` ratio. 
3. **Playlist Scroll:** The `Playlist` must not force the grid to expand vertically. If the `Playlist` is taller than the `Media Viewport`, it must scroll internally (`overflow-y: auto`).
4. **Mobile Stack:** On viewports `< 1024px`, the Reader and Playlist stack vertically.

## Action Plan
1. **Grid Setup:** In `src/components/landing/interactive-player-demo.tsx`, modify the `showPlaylist` condition to use `lg:grid lg:grid-cols-[minmax(0,2.15fr)_minmax(210px,0.85fr)]` on desktop (when not fullscreen).
2. **Playlist Height Trick:** To ensure the Playlist doesn't stretch the grid row:
   - Give the `aside` wrapper `relative lg:h-full lg:border-l lg:border-black/[0.04]`.
   - Wrap the Playlist contents (Title, List, Note) in a `<div className="flex flex-col h-full lg:absolute lg:inset-0 p-3">`.
   - This `absolute inset-0` will force the Playlist to exactly match the grid row's height, which in turn is strictly dictated by the `aspect-video` Media Viewport!
3. **Internal Scrolling:** Ensure the `<ul role="listbox">` has `min-h-0 flex-1 lg:overflow-y-auto`.
4. **No Logic Changes:** Keep all existing `InteractivePlayerDemo` logic, commands, and components intact.
