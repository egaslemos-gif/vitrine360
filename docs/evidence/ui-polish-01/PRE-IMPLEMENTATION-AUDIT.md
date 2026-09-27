# PRE-IMPLEMENTATION AUDIT

## Current State (Before)

### Design Tokens
- **Background**: `#f4f1fa` — lilac-tinted, visually dominant
- **Workspace**: `#ebe6f5` — saturated lilac workspace
- **Sidebar**: `#e4dff2` — heavy lilac panel + gradient to primary-soft
- **Borders**: Solid hex values (`#e2dceb`, `#d5cde3`, `#c4b8d9`) — visually heavy
- **Shadows**: Multi-layer with 7–12% alpha — noticeable
- **Row hover**: `#f6f3fb` — lilac tinted
- **Row selected**: `#eee9ff` — saturated purple

### Sidebar
- Background: linear gradient from sidebar color to primary-soft tint
- Active item: **solid purple fill** (`bg-[var(--color-primary)]`) with white text
- Shadow: `var(--shadow-card)` + `inset 0 1px 0 rgba(255,255,255,0.6)`
- Hover: `bg-white/60` with shadow

### Glass
- `glass-panel`: Uses `var(--color-workspace)` — visible lilac
- `glass-card`: Uses `var(--color-surface)` — opaque white
- `glass-control`: `color-mix(in oklab, var(--color-surface) 88%, transparent)` with blur(12px)

### Body
- `background: linear-gradient(135deg, #f4f1fa 0%, #ece7f6 30%, #f0edf8 60%, #f4f1fa 100%)`
- Visually creates a lilac atmosphere

### Key Issues
1. Purple/lilac dominates the entire environment
2. Borders are too strong (solid hex, not translucent)
3. Shadows are heavier than needed
4. Sidebar feels like a separate purple panel
5. Active nav item is a heavy solid purple block
6. Cards compete with background due to similar tinting

## Target State (After)
- Background: near-white `#f8f7fb`
- Sidebar: translucent white `rgba(255,255,255,0.72)`
- Active nav: soft purple tint `bg-[var(--color-primary-soft)]` with purple text
- Borders: translucent `rgba(120,100,160,0.08–0.18)`
- Shadows: 3–6% alpha range
- Purple: accent only (buttons, focus, active states)
