# Vitrine360 — RUNTIME-EXPERIENCE-09  
# Content Model + Playback Integration

**Date:** 2026-09-23  
**Status:** CONTENT MODEL + PLAYBACK INTEGRATION VALIDATED  
**Depends on:** EXPERIENCE-01 … 08, 10  
**ADR:** [ADR-EXPERIENCE-009](./adr/ADR-EXPERIENCE-009.md)

**Not claimed:** Production Ready · Experience Runtime Ready · Hisense Ready · Offline Experience · Fullscreen/Orientation CONTROL · automatic Runtime Core wiring in Player

---

## 1. Status

EXPERIENCE is a first-class **Content type** with a **pinned** Registry reference. Playlist/Manifest carry the typed ref. Execution still requires Admission (EX-08) + Runtime Core (EX-10). Players show **safe fallback** only in this phase.

## 2. Scope

In: Content type, payload ref validation, Manifest sanitize, React/Legacy boundaries, studio fields.  
Out: New executor, sandbox, bridge, upload UI, kill switch, network/storage APIs.

## 3–4. Content Model / Experience Reference

```text
Content { type: "EXPERIENCE", payload: { experience: { experienceId, version } } }
```

Stored in existing `contents.payload` JSON — **no migration**. Not a MediaAsset.

## 5. Version Pinning

Exact semver only. Forbidden: `latest`, `current`, `stable`, `useLatest`, `channel`, `autoUpdate`.

## 6. Tenant Isolation

`validateExperienceContentAgainstRegistry(tenantId, ref, lookup)` — deny cross-tenant / wrong experience / missing version without leaking other tenants.

## 7. Playlist Integration

`playlist_items` unchanged — still `contentId` only. No `playlist_experiences` table.

## 8. Manifest Integration

`type: "EXPERIENCE"` + sanitized `payload.experience`. No execution URL.  
Flags: `experienceExecutable`, `experienceBlockReason` (e.g. not PUBLISHED → `EXPERIENCE_NOT_EXECUTABLE`).

## 9. Admission Boundary

Manifest ≠ Admission. PUBLISHED ≠ ADMITTED. Player must not skip `admitExperienceForDevice()`.

## 10–11. React / Legacy Player

| Player | Behaviour |
|--------|-----------|
| React `DisplayEngine` | Safe card · no iframe/HTML/eval |
| Legacy `tv.js` | `EXPERIENCE_UNSUPPORTED` · no exec |

## 12. Security

No new eval / Function / srcDoc / blob-data Experience execution on EX-09 surface.

## 13–15. Errors / Tests / Regression

Codes: `EXPERIENCE_*` in `experience-content-ref.ts`.  
Tests: `npm run test:runtime-experience-09`.

## 16. Known Limitations

- Content create requires package present in in-process store (EX-05) for registry lookup.
- React Player does **not** yet mount `ExperienceRuntimeShell` after admission (deferred coupling).
- Duration uses existing Content/PlaylistItem ms semantics (no infinite Interactive duration).

## 17. Non-Goals

See §19 of the task brief (no new sandbox/bridge/CONTROL APIs).

## 18–19. Evidence / Verdict

- Checklist: `docs/evidence/runtime-experience-09/CONTENT-PLAYBACK-CHECKLIST.md`  
- **RUNTIME-EXPERIENCE-09 — CONTENT MODEL + PLAYBACK INTEGRATION VALIDATED**
