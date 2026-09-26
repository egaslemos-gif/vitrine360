# RESPONSIVE-QA

Breakpoints checked conceptually + CSS:

| Width | Expectation | Status |
|-------|-------------|--------|
| 1440 | Full grid cols + list columns | PASS (xl:4 media / xl:3 devices) |
| 1280 | lg grid | PASS |
| 1024 | md 2-col devices / list headers | PASS |
| 768 | Compact list; stack filters | PASS |
| 390 | Two-line list rows; no giant list cards | PASS |

List never falls back to full Grid cards on mobile.
