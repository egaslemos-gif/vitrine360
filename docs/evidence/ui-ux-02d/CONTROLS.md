# Controls

| Control | Behavior |
|---------|----------|
| Play | STOPPED→start; PAUSED→resume |
| Pause | freeze progress |
| Stop | STOPPED, position=0, same item |
| Next / Previous | loop playlist; Previous restarts if >3s |
| Restart | position=0 |
| Seek | pointer + keyboard on timeline |
| Mute / Volume | mute remembers prior volume |
| Fullscreen | Fullscreen API or CSS expand fallback |

All buttons: `aria-label`, ≥44px targets.
