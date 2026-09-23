# Hisense Physical Validation

Consolidation date: 2026-09-21.  
Classification: **HISENSE PHYSICAL PLAYBACK — PASS**

This result does not certify Android TV, an Android TV Box, or HDMI.

## Environment

| Campo | Valor |
|---|---|
| Aparelho | Smart TV Hisense, browser interno Sraf |
| Player | `v0.1.16-smarttv-static` |
| URL | `https://vitrine360-psi.vercel.app/tv.html` |
| Modo de enquadramento | Slide inteiro, fundo preto |
| Modelo comercial da TV | **NOT DOCUMENTED** |
| Ficheiro de screenshot em `docs/evidence/` | **NOT DOCUMENTED** |

## Observed result

Operator observation on 2026-09-21, after the production player reached v0.1.16:

- slides played;
- mode "slide inteiro, fundo preto";
- a portrait image was shown whole and centered;
- the portrait poster sat in the center with black bars;
- a landscape photograph was shown correctly;
- visual playback was confirmed by the operator.

## What this does not prove

- Android TV Box
- HDMI from a box to a display
- External-display certification
- Offline playback, offline reload, or offline reboot on the Hisense

The Sraf player in v0.1.16 requests each media file from the network when the slide starts. A slide already on screen can remain until the next change. The following slides are not stored on the TV. Offline reload and offline reboot on this browser stay **NOT TESTED**, and the platform limitation already recorded in `docs/OBJECTIVE-STATUS.md` still applies.

## Evidence

- Operator observation, 2026-09-21, in the validation session that confirmed v0.1.16.
- Production URL from `docs/VERCEL-DEPLOYMENT-REPORT.md`: `https://vitrine360-psi.vercel.app`.
- No media file was copied into `docs/evidence/` for this session.

## Conclusion

**HISENSE PHYSICAL PLAYBACK — PASS**

Android TV certification remains **NOT TESTED — HARDWARE NOT AVAILABLE**.

---

## Phase 3C — GIF smoke (GIF-011)

**Status (2026-09-22):** Admin/prep **PASS** · Physical Sraf observation **NOT OBSERVED** (device OFFLINE)

Contract under test: Content `IMAGE` + MediaAsset `image/gif`, Legacy `<img>` + timer.

| Gate | Result |
|------|--------|
| GIF-011-A Upload `image/gif` | **PASS** (production MediaAsset `b2fd7ea4-…`) |
| GIF-011-B Content IMAGE · 9000 ms | **PASS** (`9b5d1345-…`) |
| Playlist attach to HISENSE (`TV-CASA-001`) | **PASS** (item on playlist `f2ea84e4-…`) |
| Physical animation / timer on Sraf | **NOT OBSERVED** — presence OFFLINE at seed (`lastSeenAt` 2026-09-21) |
| Offline GIF on Hisense | **NOT OBSERVED** |

Full report: `docs/evidence/gif-011/GIF-011-RESULTS.md`

**DEVICE GIF VALIDATED — NOT CLAIMED** until an operator records Sraf playback on the powered Hisense.
