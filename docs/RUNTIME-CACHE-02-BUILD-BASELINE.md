# Vitrine360 — Post RUNTIME-CACHE-02 Build Baseline Fix

**Date:** 2026-09-22  
**Trigger:** Verification found `typecheck` / `build` / `lint` FAIL while RC-02 tests PASS  
**Scope:** Restore green software gate without changing cache architecture

---

## 1. Fixes

| Issue | Fix |
|-------|-----|
| `createSchedule` typed with `z.infer` (output) → scripts missing required `startTime`/`endTime` keys | Accept `z.input` (`CreateScheduleInput`); parse inside `createSchedule` / `updateSchedule` |
| Lint ERROR: refs updated during render (`player-app.tsx`) | Move `itemsRef` / `contentIdRef` sync into `useEffect` |
| Lint ERROR: React Compiler memo deps (`content-studio-form.tsx`) | Depend on `initial?.media?.mimeType` / `fileName` |
| Lint WARNING: unused `manifestAssets` (`engine.ts`) | Removed dead helper |

---

## 2. Regression after fix

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (0 errors; pre-existing warnings only) |
| `npm run build` | **PASS** |

---

## 3. Status

```
POST RUNTIME-CACHE-02 BUILD BASELINE — RESTORED
typecheck / build / lint — PASS
```
