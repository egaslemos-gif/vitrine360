# LANDING-HERO-12: Implementation

## 1. Hero Grid Decoupling
Modified `LandingPage.tsx`:
```tsx
// Before
<div className="... lg:items-stretch lg:grid-cols-[...]">
// After
<div className="... lg:items-start lg:grid-cols-[...]">
```
*Impact:* The Player is no longer forced to mimic the height of the Left Column.

## 2. Reader Natural Height
Modified `InteractivePlayerDemo.tsx`:
```tsx
// Before (Reader Canvas)
className={cn(
  "ui-player-canvas relative overflow-hidden w-full",
  isFullscreen ? "min-h-0 flex-1" : "aspect-video lg:aspect-auto lg:h-full lg:flex-1"
)}

// After (Reader Canvas)
className={cn(
  "ui-player-canvas relative overflow-hidden w-full",
  isFullscreen ? "min-h-0 flex-1" : "aspect-video lg:aspect-[5/4]"
)}
```
*Impact:* `h-full` and `flex-1` were removed to prevent infinite stretching. An explicit `aspect-[5/4]` guarantees a robust height (~316px) that correctly houses the Reader's content while keeping it taller than the Playlist.

## 3. Left Column Visual Balance
Modified `LandingPage.tsx`:
```tsx
// Capability Rail Before
<div className="mt-12 lg:mt-auto ...">

// Capability Rail After
<div className="mt-12 lg:mt-16 ...">
```
*Impact:* Without the flex container being stretched to match the Player, `mt-auto` evaluated to zero margin. Using an explicit `mt-16` firmly anchors the rail below the Proof while defining the natural height of the Left Column.

Modified top spacing:
```tsx
// Before
lg:pt-10
// After
lg:pt-8
```
*Impact:* Creates a much tighter "pequeno respiro" between the Navbar and the Eyebrow.
