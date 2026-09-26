# RUNTIME-PLAYBACK-05 — ERRORS

## Codes

| Code | Use |
|------|-----|
| MEDIA_LOAD_ERROR | Still media `<img onError>` / load failure |
| MEDIA_PLAY_ERROR | play() unrecoverable after muted fallback |
| MEDIA_DECODE_ERROR | VIDEO/AUDIO element `onError` |
| MEDIA_UNSUPPORTED | Reserved |
| MEDIA_TIMEOUT | Reserved |
| MEDIA_ERROR | Legacy generic |

## UX

`MediaErrorOverlay` — “Media unavailable” / play failure copy; Retry → `PLAY`.

No stack traces, URLs, tokens, tenant ids in UI.
