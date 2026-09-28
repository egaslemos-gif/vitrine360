# LANDING-HERO-05: Alignment Audit

## Current Layout Properties

**Location:** `src/features/marketing/landing-page.tsx`, around line 133.

```tsx
<div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 pt-6 pb-10 sm:gap-10 sm:px-6 sm:pt-10 sm:pb-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10 lg:pt-12 lg:pb-16">
```

### Analysis of the Grid Wrapper:
- **`grid` & `grid-cols-1` (Mobile)**: Creates a single column block layout.
- **`lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]` (Desktop)**: Creates a two-column grid. Left is roughly 46% (Copy), right is roughly 54% (Player).
- **`items-center`**: This is the `align-items: center;` CSS rule. It acts on the block-axis (vertical axis in horizontal writing modes). This forces children of the grid to center vertically within their respective grid tracks.
- **`pt-12 pb-16` (Desktop Padding)**: Provides the breathing room at the top of the container. 

### Why is the Copy too low?
Because the `items-center` centers both columns. 
The Right Column (Player) has grown taller due to the structural changes in `LANDING-HERO-04` (stacking the 16:9 media over the playlist). 
The Left Column (Hero Copy) is much shorter in content height.
As a result, the Left Column calculates its vertical position as: `(Player_Height / 2) - (Copy_Height / 2)`. This leaves an empty visual block above the Copy.

### Proposed Fix
Change `items-center` to `items-start` (and `sm:items-center` maybe? No, the user specifies that on mobile "o alinhamento deve naturalmente ser top/start" and "Não aplicar hacks específicos de desktop ao mobile"). 
So, replace `items-center` with `items-start`. This ensures both columns anchor directly to the top edge of the grid row, defined by `pt-12` (desktop padding). 
If this makes the text slightly too high relative to the Player (due to line-heights or the Player's outer shadow padding), we can add a slight top margin to the Copy column if necessary, but the user requested: "NÃO usar valores arbitrários para 'empurrar' o texto. Resolver através da estrutura/layout."
So `items-start` is the correct structural solution.
