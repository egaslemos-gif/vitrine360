# UI/UX-02C — Media Cards

**File:** `src/features/media/media-library.tsx`

| Type | Visual |
|------|--------|
| VIDEO | Cover frame + circular play + type badge |
| AUDIO | Gradient field + waveform + play circle |
| IMAGE / GIF | Dominant preview (`object-contain` / full preview) |
| Other | MIME label on muted surface |

Shared: `.ui-media-card` (large radius, soft shadow, type top accent). No fake durations.
