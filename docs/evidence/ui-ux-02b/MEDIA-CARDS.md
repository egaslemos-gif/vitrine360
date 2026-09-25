# UI/UX-02B — Media Cards

**Component:** `src/features/media/media-library.tsx` (`AssetCard`)

## Communication per card

| Signal | Implementation |
|--------|----------------|
| Thumbnail | Image/GIF preview; video poster frame; audio waveform placeholder; other = MIME label |
| Type | `TypeBadge` (semantic `--color-type-*`) |
| Title | Filename |
| Metadata | Size · date · usage count |
| Status | Usage / delete affordance (existing) |
| Accent | 3px top border tinted by media kind |

## Type-specific visuals

| Type | Visual |
|------|--------|
| VIDEO | Metadata frame + centered play indicator overlay (no fake remote controls) |
| AUDIO | Waveform-inspired bars using `--color-type-audio` |
| IMAGE | Full object-contain preview |
| GIF | Same preview path (animated when browser/asset allows) |
| Other | Muted surface + MIME string |

## Constraints honored

- No fabricated durations or fake usage data
- Accents limited to badge + thin card edge
- Hover still uses primary (purple) border soft highlight
