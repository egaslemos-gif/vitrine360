# Vitrine360 — RUNTIME-CACHE-02 Production Validation

**Date:** 2026-09-22  
**Environment:** `http://127.0.0.1:3000` · `MEDIA_STORAGE_PROVIDER=r2` · `npm start` after `next build`  
**Evidence:** `docs/evidence/runtime-cache-02/`

```text
============================================================
VITRINE360 — RUNTIME CACHE
============================================================
RUNTIME-CACHE-01  Architecture Audit
  STATUS: CLOSED

RUNTIME-CACHE-02  Persistent Media Cache & Idempotent Sync
  STATUS: PRODUCTION VALIDATED
  VERDICT: PASS
  CLOSED — DO NOT REOPEN WITHOUT REGRESSION
============================================================
```

---

## 502 diagnosis (exact layer)

```text
Browser → GET /api/device/media/{id}
  → Device Bearer OK
  → MediaAsset + tenant OK
  → storageKey present in DB
  → R2 credentials/bucket OK for healthy keys
  ✗ Failure: stale checksum-dedupe rows pointed at missing R2 objects
       (storageKey path segments 2 vs healthy 3)
  → getObject / upstream miss → HTTP 502
```

**Not** “R2 infra down.” App-side: stale dedupe + proxy preferring broken presigned fetch without SDK read.

**Minimal fixes:**

1. `src/app/api/device/media/[assetId]/route.ts` — prefer `storage.getObject()`.
2. `src/services/contents.ts` — heal stale dedupe when backing object unreadable.

Runtime Cache architecture unchanged.

---

## Acceptance checklist

| Criterion | Status |
|-----------|--------|
| Cold media download HTTP 200 | PASS |
| Bytes reais recebidos | PASS |
| SHA-256 validado | PASS |
| Asset persistido no IDB | PASS |
| NEXT criado | PASS |
| CURRENT somente após todos os assets necessários | PASS |
| Falha parcial não promove NEXT | PASS |
| CURRENT anterior permanece utilizável | PASS |
| Asset removido localmente é recuperado | PASS |
| Asset já existente não é redownloaded | PASS |
| Refresh warm não faz media HTTP | PASS |
| Background sync funciona | PASS |
| `npm test` | PASS |
| `typecheck` | PASS |
| `build` | PASS |
| `test:runtime-cache-02` | PASS |
| `test:sched-02` | PASS |
| `test:media-3a` (storage) | PASS |
| `test:cold-path-live` | PASS |
| `test:warm-cache-live` | PASS |

---

## Verdict

```text
RUNTIME-CACHE-02 — PRODUCTION VALIDATED
Classification: PASS
Status: CLOSED — DO NOT REOPEN WITHOUT REGRESSION
```

Flow proven end-to-end:

```text
SERVER MANIFEST → DOWNLOAD (/api/device/media) → VALIDATE (SHA-256)
  → NEXT → ATOMIC ACTIVATE → CURRENT → PLAYBACK (blob:)
```

### Evidence files

- `docs/evidence/runtime-cache-02/COLD-DOWNLOAD-RESULTS.md`
- `docs/evidence/runtime-cache-02/PARTIAL-FAILURE-RESULTS.md`
- `docs/evidence/runtime-cache-02/ASSET-RECOVERY-RESULTS.md`
- `docs/evidence/runtime-cache-02/WARM-CACHE-RESULTS.md`

### Limitations

- Lab PNG payloads (not production video bitrate).  
- Workspace without `.git` — commit hash not recorded.  
- Device bearer / R2 secrets never written to evidence.
