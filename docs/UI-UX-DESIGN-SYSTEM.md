# Vitrine360 — UI/UX Design System

Single source of truth for admin/player visual language. Prefer these primitives over page-local styling.

## 1. Design principles

1. Clarity over decoration  
2. Consistency across modules  
3. Clear hierarchy (page → section → card → metadata → actions)  
4. Operational density without clutter  
5. Responsive admin layouts; Player stays landscape/appliance  
6. Accessibility (focus, labels, keyboard)  
7. Aesthetics last — never at the cost of stability (especially Hisense / `tv.js`)

## 2. Layout system

- Admin pages: `mx-auto w-full max-w-7xl space-y-8` (detail pages may use `max-w-4xl`)
- Header: `PageHeader` (sticky via `.admin-page-header`)
- Grids: Devices `1/2/3` cols; Media `1/2/3/4` cols
- Filter rows: `FilterBar`

## 3. Spacing

CSS tokens in `globals.css` `@theme`:

| Token | Value |
|-------|-------|
| `--spacing-xs` | 0.25rem |
| `--spacing-sm` | 0.5rem |
| `--spacing-md` | 1rem |
| `--spacing-lg` | 1.5rem |
| `--spacing-xl` | 2rem |
| `--spacing-2xl` | 3rem |

Prefer Tailwind scale (`gap-2`, `p-4`, `space-y-6`) aligned to these steps. Avoid one-off arbitrary spacing unless required.

## 4. Typography

| Role | Pattern |
|------|---------|
| Page title | `PageHeader` → Fraunces / `--font-display`, `text-3xl`, primary colour |
| Section title | `text-base`–`text-lg` font-medium |
| Card title | `CardTitle` `text-sm`–`text-base` |
| Body | default `text-sm` |
| Secondary | `text-[var(--color-muted-foreground)]` |
| Metadata | `MetadataRow` / `text-xs` uppercase labels |
| Caption | `text-[10px]`–`text-xs` |

## 5. Colors

Semantic tokens: `primary`, `success`, `warning`, `destructive`, `info`, `neutral`, plus shadcn surfaces (`card`, `muted`, `border`).

Status mapping (`StatusBadge`):

- ONLINE / PLAYING / ACTIVE → success  
- AWAY / SYNCING / INSTABLE → warning  
- OFFLINE / ERROR → danger  
- PENDING / DISABLED → muted  

Do not hardcode hex for status colours in feature pages.

## 6. Cards

Use `@/components/ui/card` (`Card`, `CardHeader`, `CardContent`, `CardFooter`).

Structure: Header → Content/Metadata → Actions footer.

Subtle shadow (`shadow-sm` / `--shadow-subtle`), ring border, discrete hover.

## 7. Buttons

`Button` variants: `default` (primary), `secondary`/`outline`, `destructive`, `ghost`, `icon`.

One primary action per context. Secondary actions in overflow menus when crowded.

## 8. Badges

- `StatusBadge` — presence / playback / lifecycle  
- `TypeBadge` — IMAGE / VIDEO / GIF / AUDIO / PDF / EXPERIENCE / OTHER (from MIME or content type)

Every media type must show a `TypeBadge`, not only GIF.

## 9. Filters

`FilterBar` wraps search + selects in one aligned row. Clear-filters control when any filter is active.

## 10. Page headers

```tsx
<PageHeader
  title="Devices"
  description="Gestão e associação de ecrãs"
  actions={/* primary CTA */}
/>
```

## 11. Preview Viewport

`PreviewViewport` — fixed aspect (`16/9` | `4/3` | `9/16` | `1/1`). Content uses `object-contain`; container size does not follow media intrinsic size.

Used by Media Library cards and Playlist Editor timed preview.

## 12. Empty states

`EmptyState` — icon, title, description, optional CTA.

## 13. Loading states

`LoadingState` — spinner + label (same module as empty/error).

## 14. Error states

`ErrorState` — user-facing message + retry; no stack traces.

## 15. Responsive rules

- Admin usable from ~360px up; prioritize 1366×768 and 1920×1080  
- Stat cards: 2 cols tablet, 4 cols desktop  
- Playlist editor: stacked mobile; 3-column (details | items | preview) on large screens  
- Player: landscape / full viewport appliance

## 16. Accessibility

- Real `<button>` / links for actions  
- `aria-label` on icon-only controls  
- Visible focus rings (`focus-visible:ring`)  
- Status not colour-only (badge text)  
- Tooltips only on hover/focus — never permanently painted

## 17. Player controls

Fullscreen chrome binds to existing `CursorIdleController` → `RuntimeState.cursorVisible`.

- ACTIVE / cursor visible → controls shown  
- IDLE → controls hidden (`opacity: 0`, `pointer-events: none`)  
- No second idle timer; no auto `requestFullscreen()`  

Legacy `public/tv.js` path unchanged for Hisense.

## 18. Device cards

Operational level: presence badge, name, code, location, last seen, playlist, Ver detalhes + overflow actions.  
Technical telemetry lives on device detail + observability panel.

## 19. Media cards

Preview (fixed 16:9) + TypeBadge overlay → filename → size · date → usage → primary “Usar em Conteúdo” + delete when unused.

## 20. Playlist preview

`PlaylistTimedPreview` embeds `PreviewViewport` + aspect selector. Changing aspect changes viewport ratio only; page chrome does not jump from media dimensions.

---

### Component index (`src/components/ui/`)

| Component | File |
|-----------|------|
| PageHeader | `page-header.tsx` |
| StatCard | `stat-card.tsx` |
| StatusBadge | `status-badge.tsx` |
| TypeBadge | `type-badge.tsx` |
| FilterBar | `filter-bar.tsx` |
| EmptyState / ErrorState / LoadingState | `empty-state.tsx` |
| PreviewViewport | `preview-viewport.tsx` |
| MetadataRow | `metadata-row.tsx` |
| Card / Button / Badge / Dialog / … | existing shadcn-style kit |
