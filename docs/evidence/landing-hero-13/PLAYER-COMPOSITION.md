# PLAYER COMPOSITION

## Structure

```
PlayerShell (InteractivePlayerDemo)
├── Header
└── Body
    ├── Reader (MediaViewport)
    │   ├── MediaSurface (16:9)
    │   └── ControlBar (Absolute Bottom)
    └── PlaylistPanel
```

## Natural Height

- **Header:** Fixed padding/content (`~50px`).
- **Reader:** Aspect ratio based on width (`aspect-video`), providing an exact 16:9 proportional block.
- **Playlist Panel:** Purely driven by the 4 items, padding, and demo note (`~320px`).
- **Media:** Perfectly matches the `aspect-video` wrapper, utilizing `object-contain` completely free of black bars.

## Composition Matrix

- **No Shared Logical Height:** The Player grid now uses `xl:items-center`. The Reader and Playlist exist side-by-side but do not stretch each other. If the Playlist is taller than the Reader, it centers vertically in the Player body. If the Reader is taller, the Playlist centers.
- **No Player Stretching:** The Hero grid uses `xl:items-start`, allowing the Player Shell to define its own height based purely on its internal grid.
