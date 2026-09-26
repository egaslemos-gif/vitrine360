# RUNTIME-PLAYBACK-05 — MEDIA CAPABILITY MATRIX

| Type | Play | Pause | Seek | Volume | Mute | Natural End | Presentation Timer |
|------|------|-------|------|--------|------|-------------|--------------------|
| VIDEO | YES | YES | YES | YES | YES | durationMs===0 | durationMs>0 |
| AUDIO | YES | YES | YES | YES | YES | durationMs===0 | durationMs>0 |
| IMAGE | YES | YES | NO | NO | NO | NO | YES |
| GIF | YES | YES | NO | NO | NO | NO | YES (still path) |
| EXPERIENCE | runtime | runtime | NO* | NO* | NO* | hosted | EXPERIENCE_HOSTED |

\* Not exposed as fake native media controls.

## Controls (final)

| Type | Controls |
|------|----------|
| VIDEO | Play/Pause, Seek, Volume, Mute, Fullscreen, Next, Previous, Stop, Restart |
| AUDIO | Play/Pause, Seek, Volume, Mute, Fullscreen, Next, Previous, Stop, Restart |
| IMAGE | Play/Pause, Next, Previous, Stop, Restart + read-only presentation progress |
| GIF | same as IMAGE |
| EXPERIENCE | Play/Pause, Next, Previous, Stop, Restart, Fullscreen (no seek/volume/mute) |
