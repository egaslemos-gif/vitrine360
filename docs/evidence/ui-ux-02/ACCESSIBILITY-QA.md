# UI/UX-02 — Accessibility QA

| Check | Result |
|-------|--------|
| Keyboard / focus rings on nav + CTAs | PASS (existing ring tokens) |
| Landing landmarks (header/main/footer/nav) | PASS |
| Device Control disabled buttons `aria-label` | PASS |
| Progressbar labelled | PASS |
| Icon-only collapse control labelled | PASS |
| Status = colour + text (+ badge) | PASS (StatusBadge) |
| Contrast light theme | PASS (existing emerald system) |
| Dark (`html.dark`) tokens | Documented / available; no forced default dark |

Known residual: login form still defaults email/password fields in non-prod for DX.
