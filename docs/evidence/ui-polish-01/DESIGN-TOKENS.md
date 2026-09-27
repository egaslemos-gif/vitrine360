# DESIGN TOKENS — UI-POLISH-01

## Token Changes

| Token | Before | After | Rationale |
|-------|--------|-------|-----------|
| `--color-background` | `#f4f1fa` | `#f8f7fb` | Near-white, subtle warmth |
| `--color-workspace` | `#ebe6f5` | `#f3f2f7` | Lighter, less tinted |
| `--color-sidebar` | `#e4dff2` | `#f6f5fa` | Much lighter, barely tinted |
| `--color-surface-muted` | `#f1edf8` | `#f5f4f8` | Neutral muted |
| `--color-surface-elevated` | `#ffffff` | `rgba(255,255,255,0.92)` | Subtle translucency |
| `--color-primary-hover` | `#5136c9` | `#5b3de6` | Slightly brighter hover |
| `--color-primary-soft` | `#eee9ff` | `#f0ecff` | Lighter soft purple |
| `--color-muted-foreground` | `#666672` | `#71717a` | Standard zinc neutral |
| `--color-border-subtle` | `#e2dceb` | `rgba(120,100,160,0.08)` | Translucent, barely visible |
| `--color-border` | `#d5cde3` | `rgba(120,100,160,0.12)` | Translucent, thin |
| `--color-border-strong` | `#c4b8d9` | `rgba(120,100,160,0.18)` | Still subtle |
| `--color-input` | `#e6e1ef` | `#ededf2` | Neutral input field |
| `--color-row-hover` | `#f6f3fb` | `rgba(109,74,255,0.03)` | Near-invisible purple |
| `--color-row-selected` | `#eee9ff` | `rgba(109,74,255,0.06)` | Very soft purple |
| `--shadow-card` | `0.04 + 0.07` alpha | `0.03 + 0.04` alpha | Much softer |
| `--shadow-elevated` | `0.1` alpha | `0.06` alpha | Lighter |
| `--shadow-floating` | `0.12` alpha | `0.10` alpha | Slightly reduced |
| `--radius-xl` | `1.25rem (20px)` | `1.125rem (18px)` | Slightly tighter |

## Sidebar Changes
| Property | Before | After |
|----------|--------|-------|
| Background | `linear-gradient(sidebar → primary-soft)` | `rgba(255,255,255,0.72)` |
| Border | `1px solid var(--color-border-subtle)` hex | `1px solid rgba(120,100,160,0.08)` |
| Shadow | `shadow-card + inset highlight` | `shadow-card only` |
| Active item bg | `bg-[var(--color-primary)]` (solid purple) | `bg-[var(--color-primary-soft)]` (soft tint) |
| Active item text | `text-white` | `text-[var(--color-primary)]` (purple) |
| Active item shadow | `shadow-md` | `shadow-sm` |
| Hover | `bg-white/60 shadow-sm` | `bg-black/[0.03]` (no shadow) |

## Body Background
| Before | After |
|--------|-------|
| `linear-gradient(135deg, #f4f1fa → #ece7f6 → #f0edf8 → #f4f1fa)` | `#f8f7fb` (flat near-white) |
