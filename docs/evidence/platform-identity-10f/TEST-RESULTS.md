# PLATFORM-IDENTITY-10F TEST RESULTS

| Test | Result | Detail |
|------|--------|--------|
| PI10F-FLAG-01 | PASS | ENTITLEMENTS_ENABLED remains OFF by default |
| PI10F-USAGE-ZERO-01 | PASS | tenant zero devices |
| PI10F-USAGE-ZERO-02 | PASS | tenant zero media → 0 bytes |
| PI10F-USAGE-003 | PASS | devices.count server-side (PAIRED_NON_DISABLED) = 2 |
| PI10F-USAGE-MODE | PASS | device semantics canonical PAIRED_NON_DISABLED |
| PI10F-USAGE-ACTIVE | PASS | ACTIVE_ONLY mode = 1 |
| PI10F-USAGE-004 | PASS | storage.bytes server-side SUM = 350 |
| PI10F-USAGE-005 | PASS | Storage authority is DB SUM, not R2 |
| PI10F-USAGE-001 | PASS | Tenant A não vê Usage de Tenant B |
| PI10F-USAGE-ZERO-SIZE | PASS | file_size=0 ok |
| PI10F-COUNT-CONTENTS | PASS | contents.count |
| PI10F-COUNT-PLAYLISTS | PASS | playlists.count |
| PI10F-COUNT-EXP | PASS | experiences.count via contents type |
| PI10F-USAGE-007 | PASS | Usage resolver deterministic |
| PI10F-USAGE-007b | PASS | resolver deterministic repeat |
| PI10F-RESOLVE-STORAGE | PASS | storage.bytes resolved |
| PI10F-USAGE-002 | PASS | Client não consegue fornecer Usage arbitrário |
| PI10F-USAGE-006 | PASS | SUSPENDED tenant mantém Usage calculável |
| PI10F-USAGE-008 | PASS | Quota evaluator não faz I/O (pure) |
| PI10F-USAGE-009 | PASS | Quota evaluator determinístico |
| PI10F-USAGE-010 | PASS | FEATURE_GATE separado de HARD_LIMIT |
| PI10F-USAGE-011 | PASS | SOFT_LIMIT não bloqueia operação |
| PI10F-HARD-LT | PASS | usage=0 limit>0 ALLOW |
| PI10F-USAGE-012 | PASS | Nenhum endpoint existente aplica quota |

Generated: 2026-09-30T09:46:17.152Z

No quantitative enforcement. ENTITLEMENTS_ENABLED remains OFF.
