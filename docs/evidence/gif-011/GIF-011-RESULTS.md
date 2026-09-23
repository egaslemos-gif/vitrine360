# GIF-011 — Hisense Physical Validation Report

**Date:** 2026-09-22  
**Phase:** 3C-B GIF-011 (physical validation only — no product code changes)  
**Production:** `https://vitrine360-psi.vercel.app`  
**Player URL (Hisense):** `https://vitrine360-psi.vercel.app/tv.html`

---

## Verdict

```
GIF-011 SOFTWARE PREP + ADMIN GATES — PASS
GIF-011 HISENSE PHYSICAL PLAYBACK — NOT OBSERVED (DEVICE OFFLINE)
DEVICE GIF VALIDATED — NOT CLAIMED
```

The Hisense device (`TV-CASA-001` / `HISENSE`, player `0.1.16-smarttv-static`) is registered and the GIF slide was attached to its active playlist. At validation time the device presence was **OFFLINE** (`lastSeenAt` 2026-09-21T18:19:10Z). No operator observation of animation / timer / offline on Sraf was recorded in this session.

---

## Controlled asset

| Field | Value |
|-------|-------|
| Filename | `gif-011-animated.gif` |
| Path | `docs/evidence/gif-011/gif-011-animated.gif` |
| MIME | `image/gif` |
| Size | 6960 bytes |
| Dimensions | 320×180 |
| Frames | 4 (clear colour + label changes) |
| Frame duration | 400 ms |
| Slide duration | 9000 ms |
| Checksum | `sha256:5ab846bd7cc300ac12b73f238f33150ea85d69b2257c5c3f03c554cc5176735d` |
| Magic | GIF89a |

Source meta: `docs/evidence/gif-011/ASSET-META.json`

---

## Device under test

| Field | Value |
|-------|-------|
| Name | HISENSE |
| Device code | `TV-CASA-001` |
| Device id | `463c0c7d-e588-4913-9ce8-572e83a0ab4d` |
| Software | `0.1.16-smarttv-static` |
| Resolution | 1280×720 |
| Playlist id | `f2ea84e4-4b5a-4784-9f78-debd3e4f9692` |
| Presence at seed | **OFFLINE** |

Snapshot: `docs/evidence/gif-011/devices-snapshot.json`

---

## Checklist results

### GIF-011-A — Upload (Media Library)

| Check | Result |
|-------|--------|
| Upload completed | **PASS** |
| MIME `image/gif` | **PASS** |
| MediaAsset created | **PASS** (`b2fd7ea4-4a55-49e9-9aa3-30919009488a`) |
| Listed in Media Library | **PASS** |
| Checksum matches fixture | **PASS** |
| Filter GIF (admin UI visual) | **NOT RE-CHECKED in browser this session** — MIME filter logic already covered by `test:gif-3c` GIF-002; asset is `image/gif` |

Evidence: `upload-response.json`, Media list row in attach log.

### GIF-011-B — Content Studio

| Check | Result |
|-------|--------|
| `type = IMAGE` | **PASS** |
| Linked MediaAsset `image/gif` | **PASS** |
| `durationMs = 9000` (8–10 s) | **PASS** |
| Status ACTIVE | **PASS** |
| Content id | `9b5d1345-a1e4-47f8-acfc-c2b139c28c29` |

Evidence: `content-response.json`, `content-list-row.json`

### GIF-011-C — Playlist / Manifest wire

| Check | Result |
|-------|--------|
| Added to Hisense playlist | **PASS** (item `783d5e6e-8ede-4599-8ce9-036822fd74b3`) |
| Manifest rebuild on device sync | **PENDING** — device offline; will refresh on next sync when TV opens `tv.html` |

Evidence: `playlist-item-response.json`

### GIF-011-D — Physical playback (Sraf)

| Check | Result |
|-------|--------|
| Slide appears as IMAGE | **NOT OBSERVED** |
| GIF animates (not first frame only) | **NOT OBSERVED** |
| Advances on timer (~9 s), not loop-complete | **NOT OBSERVED** |
| Offline after cache | **NOT OBSERVED** (prior Hisense offline remains NOT TESTED) |

### GIF-011-E — Policy freeze

| Check | Result |
|-------|--------|
| No Content type `GIF` | **PASS** (frozen; automated GIF-010) |
| Runtime remains `<img>` + timer | **PASS** (no Player change this phase) |

---

## Operator finish (when Hisense is powered)

1. Open `https://vitrine360-psi.vercel.app/tv.html` on the Hisense Sraf browser (same device as prior PASS).  
2. Confirm device becomes ONLINE in Admin.  
3. Wait for sync / playlist refresh.  
4. Observe slide **GIF-011 Hisense Validation**:
   - colour frames cycle (red → green → blue → yellow);  
   - after ~9 s the playlist advances (may cut mid-animation).  
5. Optional offline: after one online cycle, disconnect network and note whether cached GIF still shows.  
6. Update this report + `docs/HISENSE-PHYSICAL-VALIDATION.md` with **PASS** / **FAIL** / **KNOWN LIMITATION** and date/operator.

Until step 4 is recorded by an operator in front of the TV, **do not** mark device GIF VALIDATED.

---

## Explicit non-claims

- Not Android TV / HDMI certification.  
- Not offline reboot.  
- Not production deploy of 3C-B Studio badges (playback path does not require that deploy).  
- Not physical animation PASS.

---

## Artifacts

| File | Role |
|------|------|
| `gif-011-animated.gif` | Controlled asset |
| `ASSET-META.json` | Asset registration |
| `upload-response.json` | MediaAsset id |
| `content-response.json` / `content-list-row.json` | Content IMAGE |
| `devices-snapshot.json` | Includes HISENSE |
| `playlist-item-response.json` | Playlist attach |
| `seed-production.mjs` / `attach-hisense.mjs` | One-shot validation helpers (evidence only) |
