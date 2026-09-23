# UI/UX Standardization — Validation Checklist

Date: 2026-09-23  
Scope: Design System SSoT + Player / Devices / Media / Playlist Preview

## Acceptance

- [x] Design System audited
- [x] Tokens consolidated (`globals.css`: spacing, radius-xl, shadows, info/neutral)
- [x] Cards padronizados (`Card` + MetadataRow patterns)
- [x] Buttons padronizados (existing `Button` variants)
- [x] Status badges padronizados (`StatusBadge`)
- [x] Type badges padronizados (`TypeBadge` on all media types)
- [x] Page Headers padronizados (`PageHeader`)
- [x] Filter Bars padronizadas (`FilterBar`)
- [x] Empty States padronizados
- [x] Loading States padronizados (`LoadingState`)
- [x] Error States padronizados (`ErrorState`)
- [x] Action menus (existing DeviceActions / DropdownMenu)
- [x] Devices reorganizado (StatCards + FilterBar + card hierarchy)
- [x] Device cards melhorados
- [x] Device details hierarquizados (Identificação / Estado & Runtime)
- [x] Media Library reorganizada (tabs + FilterBar + uniform cards)
- [x] Todos os tipos de media possuem Type Badge
- [x] Playlist Preview possui viewport estável (`PreviewViewport`)
- [x] Aspect ratio controlado (16:9 / 4:3 / 9:16 / 1:1)
- [x] Player controls desaparecem em idle (`cursorVisible`)
- [x] Fullscreen button não fica permanentemente visível
- [x] Tooltips não ficam permanentemente visíveis (title only while chrome visible)
- [x] Light mode preservado (CSS variables)
- [ ] Dark mode preservado — N/A dedicated dark theme tokens not shipped; no new hardcoded light-only breaks beyond existing surfaces
- [x] Responsive patterns applied (grids / max-width)
- [x] Accessibility basics (labels, aria on icon buttons, focus rings)
- [ ] Hisense não regressou — **requires physical retest** (React chrome only; `tv.js` untouched this pass)
- [x] Runtime Policy not intentionally changed
- [x] Fullscreen policy not auto-requested
- [x] Playback / Sync / Experience domain logic not altered

## Manual visual QA (admin)

### Devices
- [ ] 3 devices grid
- [ ] 0 devices empty state
- [ ] online/offline mix badges
- [ ] filters + clear
- [ ] actions menu
- [ ] detail sections

### Media Library
- [ ] IMAGE / VIDEO / GIF / OTHER each show TypeBadge
- [ ] tabs counts
- [ ] fixed 16:9 preview

### Playlist
- [ ] aspect selector changes viewport without layout jump from media size
- [ ] image / video / text slides contain-fit

### Player (Chromium)
- [ ] controls visible after input
- [ ] controls hidden after idle
- [ ] fullscreen enter/exit only when chrome visible

## Automation

See `REGRESSION-RESULTS.md` after CI/local run.
