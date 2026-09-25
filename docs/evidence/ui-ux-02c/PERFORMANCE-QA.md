# UI/UX-02C — Performance QA

| Concern | Mitigation |
|---------|------------|
| backdrop-filter | Limited to glass-panel / glass-card / glass-control / glass-player-controls / page header |
| Shadows | Soft low-opacity; not stacked heavily |
| Runtime Player (`html.player-runtime`) | Unchanged solid dark — no glass dependency |
| `@supports` fallback | Solid surfaces when blur unavailable |

No continuous animation or large parallax added.
