# PI-10M — Scenario Worksheets

## Replacement — quota=100, A=40, B=70 (MODEL A)

| Step | committed | reserved | Notes |
|------|-----------|----------|-------|
| Start | 40 | 0 | A counts |
| Reserve delta=30 | 40 | 30 | 70 ≤ 100 ALLOW |
| PUT B + HEAD OK | 40 | 30 | A still logical |
| UPDATE A→B metadata | 70 | 0 | Same MediaAsset id |
| Delete old key (best effort) | 70 | 0 | Orphan if delete fails |

**B invalid:** release 30; A stays 40.

## Replacement — quota=100, A=40, B=80

Reserve delta=40 → effective 80 ≤ 100 → **ALLOW**. Final committed=80.

## Replacement — MODEL B false deny

Reserve full 70 with A=40 → effective 110 > 100 → DENY despite final 70 ≤ 100.

## TTL — abandoned prepare

RESERVED expiresAt=+900s → no complete → next reserve (or worker) → RELEASED → capacity free; R2 object may orphan (not quota).
