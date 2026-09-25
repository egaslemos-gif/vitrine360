# Demo State

Local React state only:

| Field | Notes |
|-------|-------|
| status | PLAYING / PAUSED / STOPPED |
| currentIndex | 0…n-1, loops |
| positionMs | 0…durationMs, tick 100ms while PLAYING |
| volume | 0–100; mute restores previous |
| muted | boolean |

No Device Runtime state reuse.
