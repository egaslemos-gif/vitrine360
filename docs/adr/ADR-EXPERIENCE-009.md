# ADR-EXPERIENCE-009 — Experience as Content + Manifest Reference

**Status:** Accepted — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-09  
**Depends on:** ADR-EXPERIENCE-001 … 008, 010  
**Related:** `docs/RUNTIME-EXPERIENCE-09-CONTENT-PLAYBACK-INTEGRATION.md`

---

## Context

EX-10 provides Runtime Core; EX-08 Admission; EX-05/06/07 origin/sandbox/bridge. The distribution path Content → Playlist → Manifest lacked a typed Experience reference. Prior phases forbade premature `CONTENT_TYPES` expansion.

---

## Decision

1. Add **`EXPERIENCE`** to `CONTENT_TYPES` (not `HTML_APP`).  
2. Represent references as **`payload.experience.{experienceId,version}`** on existing `contents.payload` (no speculative migration).  
3. **Pin exact semver** — forbid latest/current/stable/useLatest.  
4. Keep **PlaylistItem generic** (`contentId` only).  
5. Manifest carries **typed sanitized ref**; never an arbitrary execution URL.  
6. **Admission remains mandatory** before Runtime Core.  
7. React + Legacy Players: **safe non-execution** fallbacks only in this phase.  
8. Reuse package store / registry records — no second publication system.

---

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| HTML_APP parallel type | Competing concepts |
| MediaAsset for Experience bytes | Wrong abstraction |
| latest channel resolution | Non-deterministic / unsafe |
| Playlist → Experience FK | Bypasses Content model |
| Manifest iframe URL | Arbitrary execution |
| Auto-run Runtime in Player now | Skips careful EX-09/10 boundary |

---

## Consequences

Content can reference Experiences; Manifest distributes refs safely; execution still gated. Studio gains minimal experienceId/version fields.

---

## References

- `src/domain/experience-content-ref.ts`  
- `src/services/contents.ts` / `manifest.ts`  
- `npm run test:runtime-experience-09`
