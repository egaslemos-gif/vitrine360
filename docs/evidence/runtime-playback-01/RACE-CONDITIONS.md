# RACE-CONDITIONS — RUNTIME-PLAYBACK-01

## Mechanism

`generation` increments on every item selection / restart. Media callbacks must carry the generation from when the media was bound. Mismatch → ignore.

## Covered scenarios (unit tests)

| Scenario | Test |
|----------|------|
| Stale onEnded after NEXT | 021 |
| NEXT during LOAD | 022 |
| STOP during LOAD | 023 |
| ERROR then PLAY reload | 024 |
| SEEK during known duration | 015–017 |
| PLAY → NEXT | 009 |
| PREVIOUS with position > 3s | 013 |

## Guarantees

- No advancement of wrong item from delayed media events
- STOP preserves identity with position 0
- Invalid seek (NaN/Infinity/negative/>duration) rejected or clamped
- Mute does not zero volume
