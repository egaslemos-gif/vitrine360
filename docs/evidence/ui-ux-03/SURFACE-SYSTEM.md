# SURFACE-SYSTEM

## Hierarchy

1. **App background** (`--color-app-bg` = `#F4F1FA`) — outer admin shell
2. **Sidebar** (`--color-sidebar` = `#F1EEFA`) — `.ui-sidebar-panel`
3. **Workspace** (`--color-workspace` = `#F9F8FC`) — `.ui-workspace` main pane
4. **Surface / card** (`--color-surface` = `#FFFFFF`) — records, toolbar, list shell
5. **Elevated** — `--shadow-elevated` / `--shadow-floating`
6. **Glass** — reserved for overlays / floating chrome, not primary page fill

## Borders & shadows

- `--color-border-subtle` / `--color-border` / `--color-border-strong`
- `--shadow-card`: `0 2px 10px rgba(30,20,60,.04)`
- `--shadow-elevated`: `0 8px 30px rgba(30,20,60,.08)`

## Separation rule

Cards distinguish from workspace via **background + border + subtle shadow + spacing** — not saturated fills.

## Active navigation

Soft lavender (`--color-primary-soft`) + purple text/icon. Green reserved for ONLINE/SUCCESS status.
